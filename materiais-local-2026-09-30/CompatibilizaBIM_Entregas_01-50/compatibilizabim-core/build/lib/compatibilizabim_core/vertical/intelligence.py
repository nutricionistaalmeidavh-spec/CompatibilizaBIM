from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pydantic import BaseModel, ConfigDict, Field

from cbim_sdk import CBIMProject
from cbim_sdk.models import (
    Beam, Column, Door, Equipment, Fitting, Opening, Pipe, Point3D, Relation,
    Slab, Space, Wall, Window,
)


class VerticalModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RepeatedStoreyGroup(VerticalModel):
    building_id: str | None
    fingerprint: str
    storey_ids: list[str]
    storey_names: list[str]
    confidence: float = Field(ge=0, le=1)


class VerticalStack(VerticalModel):
    stack_type: str
    building_id: str | None
    element_ids: list[str]
    storey_ids: list[str]
    xy_key: tuple[int, int]
    confidence: float = Field(ge=0, le=1)


class PropagationProposal(VerticalModel):
    source_storey_id: str
    target_storey_id: str
    source_element_ids: list[str]
    delta_z: float
    reason: str = "repeated_storey"


class VerticalIntelligenceReport(VerticalModel):
    repeated_groups: list[RepeatedStoreyGroup] = Field(default_factory=list)
    vertical_stacks: list[VerticalStack] = Field(default_factory=list)
    propagation_proposals: list[PropagationProposal] = Field(default_factory=list)


def _r(value: float, tol: float) -> int:
    return round(value / tol)


def _points_signature(points: list[Point3D], z0: float, tol: float):
    return tuple((_r(p.x, tol), _r(p.y, tol), _r(p.z-z0, tol)) for p in points)


def _element_signature(e, z0: float, tol: float):
    base = [e.type, e.name]
    if isinstance(e, Wall):
        base += [_points_signature([e.start, e.end], z0, tol), _r(e.thickness, tol), _r(e.height, tol)]
    elif isinstance(e, Column):
        base += [(_r(e.center.x,tol),_r(e.center.y,tol),_r(e.center.z-z0,tol)),_r(e.width,tol),_r(e.depth,tol),_r(e.height,tol),round(e.rotation_deg,2)]
    elif isinstance(e, Beam):
        base += [_points_signature([e.start,e.end],z0,tol),_r(e.width,tol),_r(e.height,tol)]
    elif isinstance(e, Slab):
        base += [_points_signature(e.boundary,z0,tol),_r(e.thickness,tol)]
    elif isinstance(e, (Door,Window,Opening)):
        p=e.position;base += [(_r(p.x,tol),_r(p.y,tol),_r(p.z-z0,tol)),_r(e.width,tol),_r(e.height,tol)]
    elif isinstance(e, Space):
        base += [_points_signature(e.boundary,z0,tol),_r(e.height,tol)]
    elif isinstance(e, Pipe):
        base += [_points_signature(e.path,z0,tol),_r(e.diameter,tol),e.system_id]
    elif isinstance(e, Fitting):
        p=e.position;base += [(_r(p.x,tol),_r(p.y,tol),_r(p.z-z0,tol)),e.fitting_type,e.nominal_diameter,e.system_id]
    elif isinstance(e, Equipment):
        p=e.position;base += [(_r(p.x,tol),_r(p.y,tol),_r(p.z-z0,tol)),e.equipment_type,e.system_id]
    return tuple(base)


def _centroid_xy(e) -> tuple[float,float] | None:
    if isinstance(e,Wall): return ((e.start.x+e.end.x)/2,(e.start.y+e.end.y)/2)
    if isinstance(e,Column): return e.center.x,e.center.y
    if isinstance(e,Beam): return ((e.start.x+e.end.x)/2,(e.start.y+e.end.y)/2)
    if isinstance(e,(Door,Window,Opening,Fitting,Equipment)): return e.position.x,e.position.y
    if isinstance(e,(Slab,Space)):
        if not e.boundary:return None
        return sum(p.x for p in e.boundary)/len(e.boundary),sum(p.y for p in e.boundary)/len(e.boundary)
    if isinstance(e,Pipe):
        return sum(p.x for p in e.path)/len(e.path),sum(p.y for p in e.path)/len(e.path)
    return None


def _stack_kind(e) -> str:
    if isinstance(e,Pipe): return "riser"
    if isinstance(e,Column): return "column_stack"
    if isinstance(e,Space) and ("SHAFT" in (e.name or "").upper() or bool(e.properties.get("shaft"))): return "shaft"
    if isinstance(e,Wall): return "wall_alignment"
    return "vertical_alignment"


def _translate_z(e, dz: float, new_id: str, new_storey: str, host_map: dict[str,str]):
    d=e.model_dump(mode="python",exclude={"length"});d["id"]=new_id;d["storey_id"]=new_storey
    if isinstance(e,Wall):
        d["start"]=Point3D(x=e.start.x,y=e.start.y,z=e.start.z+dz);d["end"]=Point3D(x=e.end.x,y=e.end.y,z=e.end.z+dz)
    elif isinstance(e,Column):d["center"]=Point3D(x=e.center.x,y=e.center.y,z=e.center.z+dz)
    elif isinstance(e,Beam):
        d["start"]=Point3D(x=e.start.x,y=e.start.y,z=e.start.z+dz);d["end"]=Point3D(x=e.end.x,y=e.end.y,z=e.end.z+dz)
    elif isinstance(e,(Slab,Space)):d["boundary"]=[Point3D(x=p.x,y=p.y,z=p.z+dz) for p in e.boundary]
    elif isinstance(e,Pipe):d["path"]=[Point3D(x=p.x,y=p.y,z=p.z+dz) for p in e.path]
    elif isinstance(e,(Door,Window,Opening,Fitting,Equipment)):
        p=e.position;d["position"]=Point3D(x=p.x,y=p.y,z=p.z+dz)
    if "host_id" in d and d["host_id"] in host_map:d["host_id"]=host_map[d["host_id"]]
    d["properties"]={**d.get("properties",{}),"vertical_propagated":True,"propagated_from":e.id}
    return type(e).model_validate(d)


class VerticalBuildingIntelligence:
    def __init__(self, *, geometry_tolerance_m: float = 0.01, alignment_tolerance_m: float = 0.05):
        self.geometry_tolerance=geometry_tolerance_m;self.alignment_tolerance=alignment_tolerance_m

    def fingerprint_storey(self, project: CBIMProject, storey_id: str) -> str:
        storey=next(s for s in project.storeys if s.id==storey_id)
        signatures=sorted(repr(_element_signature(e,storey.elevation,self.geometry_tolerance)) for e in project.elements if e.storey_id==storey_id)
        payload=json.dumps(signatures,separators=(",",":"),ensure_ascii=True).encode()
        return hashlib.sha256(payload).hexdigest()

    def repeated_storeys(self, project: CBIMProject) -> list[RepeatedStoreyGroup]:
        groups=defaultdict(list)
        for s in project.storeys:
            groups[(s.building_id,self.fingerprint_storey(project,s.id))].append(s)
        out=[]
        for (bid,fp),storeys in groups.items():
            if len(storeys)<2:continue
            out.append(RepeatedStoreyGroup(building_id=bid,fingerprint=fp,storey_ids=[s.id for s in storeys],storey_names=[s.name for s in storeys],confidence=1.0))
        return sorted(out,key=lambda g:(str(g.building_id),g.storey_names))

    def vertical_stacks(self, project: CBIMProject) -> list[VerticalStack]:
        stores={s.id:s for s in project.storeys};groups=defaultdict(list);tol=self.alignment_tolerance
        for e in project.elements:
            if not e.storey_id or e.storey_id not in stores:continue
            c=_centroid_xy(e)
            if c is None:continue
            # dimensions/system prevent unrelated objects at the same XY from stacking.
            dim=None
            if isinstance(e,Column):dim=(round(e.width,3),round(e.depth,3))
            elif isinstance(e,Pipe):dim=(round(e.diameter,4),e.system_id)
            elif isinstance(e,Wall):dim=(round(e.thickness,3),round(e.length,2))
            elif isinstance(e,Space):dim=(e.name or "",)
            else:dim=(e.type,)
            key=(stores[e.storey_id].building_id,_stack_kind(e),_r(c[0],tol),_r(c[1],tol),dim)
            groups[key].append(e)
        out=[]
        for (bid,kind,x,y,_),els in groups.items():
            storey_ids=sorted({e.storey_id for e in els if e.storey_id})
            if len(storey_ids)<2:continue
            confidence=min(1.0,0.82+0.03*len(storey_ids))
            out.append(VerticalStack(stack_type=kind,building_id=bid,element_ids=sorted(e.id for e in els),storey_ids=storey_ids,xy_key=(x,y),confidence=confidence))
        return sorted(out,key=lambda x:(str(x.building_id),x.stack_type,x.xy_key))

    def propagation_plan(self, project: CBIMProject, source_storey_id: str, target_storey_ids: list[str], *, only_confirmed: bool = False) -> list[PropagationProposal]:
        stores={s.id:s for s in project.storeys}
        if source_storey_id not in stores:raise KeyError(f"unknown source storey {source_storey_id}")
        source=stores[source_storey_id];source_ids=[e.id for e in project.elements if e.storey_id==source_storey_id and (not only_confirmed or e.review_state in {"confirmed","edited"})]
        proposals=[]
        for tid in target_storey_ids:
            if tid not in stores:raise KeyError(f"unknown target storey {tid}")
            target=stores[tid]
            if source.building_id != target.building_id:raise ValueError("vertical propagation must stay within one building")
            proposals.append(PropagationProposal(source_storey_id=source_storey_id,target_storey_id=tid,source_element_ids=source_ids,delta_z=target.elevation-source.elevation))
        return proposals

    def apply_propagation(self, project: CBIMProject, proposal: PropagationProposal) -> CBIMProject:
        p=project.model_copy(deep=True);by={e.id:e for e in p.elements};existing={e.id for e in p.elements};id_map={}
        for sid in proposal.source_element_ids:
            if sid not in by:raise KeyError(f"unknown source element {sid}")
            new_id=f"{sid}__{proposal.target_storey_id}"
            if new_id in existing:raise ValueError(f"propagated element already exists: {new_id}")
            id_map[sid]=new_id
        clones=[_translate_z(by[sid],proposal.delta_z,id_map[sid],proposal.target_storey_id,id_map) for sid in proposal.source_element_ids]
        p.elements.extend(clones)
        source_set=set(proposal.source_element_ids)
        new_rel=[]
        for rel in p.relations:
            if rel.from_id in source_set and rel.to_id in source_set:
                d=rel.model_dump(mode="python");d["id"]=f"{rel.id}__{proposal.target_storey_id}";d["from_id"]=id_map[rel.from_id];d["to_id"]=id_map[rel.to_id];d["metadata"]={**rel.metadata,"vertical_propagated":True}
                new_rel.append(Relation.model_validate(d))
        p.relations.extend(new_rel)
        return CBIMProject.model_validate(p.model_dump(mode="python",exclude_computed_fields=True))

    def analyze(self, project: CBIMProject) -> VerticalIntelligenceReport:
        groups=self.repeated_storeys(project);proposals=[]
        for g in groups:
            source=g.storey_ids[0]
            proposals.extend(self.propagation_plan(project,source,g.storey_ids[1:]))
        return VerticalIntelligenceReport(repeated_groups=groups,vertical_stacks=self.vertical_stacks(project),propagation_proposals=proposals)
