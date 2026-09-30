from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass
from itertools import product

from pydantic import BaseModel, ConfigDict
from cbim_sdk import CBIMProject
from cbim_sdk.models import Equipment, Fitting, Pipe, Point3D, SanitaryTerminal


class ZReconstructionReport(BaseModel):
    model_config = ConfigDict(extra='forbid')
    direct_resolved: int = 0
    propagated: int = 0
    vertical_resolved: int = 0
    unresolved: int = 0
    conflicting: int = 0


@dataclass(frozen=True)
class ZReconstructionConfig:
    connect_tolerance_m: float = .03
    conflict_tolerance_m: float = .05
    max_local_abs_elevation_m: float = 100.0
    project_datum_elevation_m: float | None = None


def _xy(p: Point3D) -> tuple[float,float]:
    return p.x,p.y


def _distance_xy(a: Point3D,b: Point3D)->float:
    return math.hypot(a.x-b.x,a.y-b.y)


def _connectors(e):
    if isinstance(e,Pipe):
        return [e.path[0],e.path[-1]] if e.path else []
    if isinstance(e,(Fitting,Equipment,SanitaryTerminal)):
        return [e.position]
    return []


def _set_uniform_z(e,z:float,source:str):
    p=e.model_copy(deep=True)
    if isinstance(p,Pipe):
        p.path=[Point3D(x=q.x,y=q.y,z=z) for q in p.path]
        if len(p.path)>=2:
            dz=p.path[-1].z-p.path[0].z
            length_xy=sum(math.hypot(b.x-a.x,b.y-a.y) for a,b in zip(p.path,p.path[1:]))
            p.slope=(dz/length_xy) if length_xy>1e-9 else None
    elif isinstance(p,(Fitting,Equipment,SanitaryTerminal)):
        q=p.position;p.position=Point3D(x=q.x,y=q.y,z=z)
    props=dict(p.properties)
    props.update({'z_reconstruction_source':source,'z_reconstruction_pending':False})
    props.pop('z_unresolved_reason',None)
    p.properties=props
    return p


def _set_vertical_leg(pipe:Pipe,target_z:float,base_z:float,anchor_x:float|None,anchor_y:float|None,source:str):
    p=pipe.model_copy(deep=True)
    flat=[Point3D(x=q.x,y=q.y,z=base_z) for q in p.path]
    if len(flat)<2:
        return _set_uniform_z(p,target_z,source)
    if anchor_x is None or anchor_y is None:
        idx=len(flat)-1
    else:
        idx=min((0,len(flat)-1), key=lambda i: math.hypot(flat[i].x-anchor_x,flat[i].y-anchor_y))
    if idx==0:
        endpoint=flat[0]
        path=[Point3D(x=endpoint.x,y=endpoint.y,z=target_z),endpoint,*flat[1:]]
    else:
        endpoint=flat[-1]
        path=[*flat,Point3D(x=endpoint.x,y=endpoint.y,z=target_z)]
    p.path=path
    props=dict(p.properties)
    props.update({'z_reconstruction_source':source,'z_reconstruction_pending':False,'vertical_target_z_m':round(target_z,6)})
    props.pop('z_unresolved_reason',None)
    p.properties=props
    return p


class _XYGrid:
    def __init__(self,tol:float):
        self.tol=tol
        self.cells=defaultdict(list)
    def key(self,p:Point3D):
        return (math.floor(p.x/self.tol),math.floor(p.y/self.tol))
    def add(self,eid:str,p:Point3D):
        self.cells[self.key(p)].append((eid,p))
    def nearby(self,p:Point3D):
        k=self.key(p)
        for dx,dy in product((-1,0,1),repeat=2):
            yield from self.cells[(k[0]+dx,k[1]+dy)]


class MEPZReconstructor:
    def __init__(self,config:ZReconstructionConfig=ZReconstructionConfig()):
        if config.connect_tolerance_m<=0: raise ValueError('connect_tolerance_m must be positive')
        self.config=config

    def _storey_elevation(self,project:CBIMProject,e)->float:
        by={s.id:s for s in project.storeys}
        return by[e.storey_id].elevation if e.storey_id in by else 0.0

    def _adjacent_storey_target(self,project:CBIMProject,e,direction:str)->float|None:
        if not e.storey_id:return None
        stores=sorted(project.storeys,key=lambda s:s.elevation)
        idx=next((i for i,s in enumerate(stores) if s.id==e.storey_id),None)
        if idx is None:return None
        if direction=='up' and idx+1<len(stores): return stores[idx+1].elevation
        if direction=='down' and idx-1>=0:return stores[idx-1].elevation
        return None

    def _target_z(self,project:CBIMProject,e):
        props=e.properties
        base=self._storey_elevation(project,e)
        if props.get('height_hint_m') is not None:
            return base+float(props['height_hint_m']),'height_hint',None
        if props.get('elevation_hint_m') is not None:
            raw=float(props['elevation_hint_m'])
            if self.config.project_datum_elevation_m is not None:
                return raw-self.config.project_datum_elevation_m,'elevation_hint_datum',None
            if abs(raw)<=self.config.max_local_abs_elevation_m:
                return raw,'elevation_hint_local',None
            return None,None,'project_datum_required'
        direction=props.get('vertical_direction')
        if direction in {'up','down'}:
            target=self._adjacent_storey_target(project,e,direction)
            if target is not None:return target,'vertical_to_adjacent_storey',None
            return None,None,'vertical_target_unknown'
        return None,None,None

    def reconstruct(self,project:CBIMProject)->tuple[CBIMProject,ZReconstructionReport]:
        p=project.model_copy(deep=True)
        by_id={e.id:e for e in p.elements}
        direct=set(); vertical=set(); unresolved=set(); conflicts=set()
        mep_ids=[e.id for e in p.elements if isinstance(e,(Pipe,Fitting,Equipment,SanitaryTerminal)) and getattr(e,'system_id',None)]

        for eid in mep_ids:
            e=by_id[eid];target,source,reason=self._target_z(p,e)
            if reason:
                q=e.model_copy(deep=True);props=dict(q.properties);props['z_reconstruction_pending']=True;props['z_unresolved_reason']=reason;q.properties=props;by_id[eid]=q;unresolved.add(eid);continue
            if target is None:continue
            direction=e.properties.get('vertical_direction')
            if isinstance(e,Pipe) and direction in {'up','down'}:
                base=self._storey_elevation(p,e)
                q=_set_vertical_leg(e,target,base,e.properties.get('vertical_anchor_x'),e.properties.get('vertical_anchor_y'),source or 'vertical')
                by_id[eid]=q;vertical.add(eid)
            else:
                by_id[eid]=_set_uniform_z(e,target,source or 'direct_hint');direct.add(eid)

        # Existing non-zero source geometry is evidence too. Preserve it as an anchor
        # so connected terminals/components can inherit a known CAD Z without inventing one.
        for eid in mep_ids:
            if eid in direct or eid in vertical or eid in unresolved: continue
            e=by_id[eid]; zs=[q.z for q in _connectors(e)]
            if zs and any(abs(float(z))>1e-9 for z in zs): direct.add(eid)

        # Rebuild element list before graphing.
        p.elements=[by_id.get(e.id,e) for e in p.elements]
        by_id={e.id:e for e in p.elements}

        # Build same-system XY element graph.
        grids=defaultdict(lambda:_XYGrid(self.config.connect_tolerance_m))
        for eid in mep_ids:
            e=by_id[eid]
            for point in _connectors(e):grids[e.system_id].add(eid,point)
        adjacency=defaultdict(set)
        for eid in mep_ids:
            e=by_id[eid]
            for point in _connectors(e):
                for oid,op in grids[e.system_id].nearby(point):
                    if oid!=eid and _distance_xy(point,op)<=self.config.connect_tolerance_m:
                        adjacency[eid].add(oid);adjacency[oid].add(eid)

        seen=set();propagated=set()
        for start in mep_ids:
            if start in seen:continue
            comp=[];dq=deque([start]);seen.add(start)
            while dq:
                cur=dq.popleft();comp.append(cur)
                for nxt in adjacency.get(cur,()):
                    if nxt not in seen:seen.add(nxt);dq.append(nxt)
            anchor_values=[]
            for eid in comp:
                if eid not in direct and eid not in vertical:continue
                e=by_id[eid]
                zs=[q.z for q in _connectors(e)]
                anchor_values.extend(zs)
            uniq=[]
            for z in anchor_values:
                if not any(abs(z-u)<=self.config.conflict_tolerance_m for u in uniq):uniq.append(z)
            unresolved_comp=[eid for eid in comp if eid not in direct and eid not in vertical]
            if len(uniq)==1:
                z=uniq[0]
                for eid in unresolved_comp:
                    by_id[eid]=_set_uniform_z(by_id[eid],z,'network_propagation');propagated.add(eid);unresolved.discard(eid)
            elif len(uniq)>1:
                for eid in unresolved_comp:
                    q=by_id[eid].model_copy(deep=True);props=dict(q.properties);props['z_reconstruction_pending']=True;props['z_unresolved_reason']='conflicting_network_anchors';q.properties=props;by_id[eid]=q;conflicts.add(eid);unresolved.add(eid)

        p.elements=[by_id.get(e.id,e) for e in p.elements]
        p.metadata['z_reconstruction_direct_resolved_count']=len(direct)
        p.metadata['z_reconstruction_vertical_resolved_count']=len(vertical)
        p.metadata['z_reconstruction_propagated_count']=len(propagated)
        p.metadata['z_reconstruction_unresolved_count']=len(unresolved)
        p.metadata['z_reconstruction_conflicting_count']=len(conflicts)
        report=ZReconstructionReport(direct_resolved=len(direct),propagated=len(propagated),vertical_resolved=len(vertical),unresolved=len(unresolved),conflicting=len(conflicts))
        return CBIMProject.model_validate(p.model_dump(mode='python',exclude_computed_fields=True)),report
