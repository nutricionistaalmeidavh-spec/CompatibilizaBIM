from __future__ import annotations

import math
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from cbim_sdk import CBIMProject

ChangeKind = Literal['added','removed','modified']

class DiffModel(BaseModel):
    model_config = ConfigDict(extra='forbid')

class ElementChange(DiffModel):
    kind: ChangeKind
    element_type: str
    before_id: str | None = None
    after_id: str | None = None
    identity: str
    categories: list[str] = Field(default_factory=list)
    details: dict[str, object] = Field(default_factory=dict)

class ProjectDiff(DiffModel):
    before_project_id: str
    after_project_id: str
    changes: list[ElementChange] = Field(default_factory=list)
    counts: dict[str, int] = Field(default_factory=dict)

    @property
    def changed_element_count(self) -> int:
        return len(self.changes)


def _source_identity(element) -> str | None:
    if not element.source_refs:
        return None
    refs = sorted((r.source_type, r.entity_id, r.layer or '') for r in element.source_refs)
    # source_id may be run-specific (DXF importer includes a nonce); CAD entity handles
    # and XREF-namespaced entity IDs are the stable revision identity.
    return f"{element.type}:source:" + '|'.join(':'.join(map(str, r)) for r in refs)


def _identity(element) -> str:
    # Stable CBIM IDs win. Source provenance lets revision imports retain identity
    # even when a producer regenerated CBIM IDs.
    return _source_identity(element) or f'{element.type}:id:{element.id}'


def _num_equal(a, b, tolerance: float) -> bool:
    return math.isclose(float(a), float(b), abs_tol=tolerance, rel_tol=0.0)


def _geometry_payload(element) -> dict:
    data = element.model_dump(mode='python', exclude={'source_refs','properties','confidence','review_state','material_ids','name','storey_id'})
    data.pop('id', None); data.pop('type', None); data.pop('system_id', None)
    return data


def _values_equal(a, b, tolerance: float) -> bool:
    if type(a) is not type(b):
        # ints/floats are semantically compatible here.
        if isinstance(a, (int,float)) and isinstance(b, (int,float)):
            return _num_equal(a,b,tolerance)
        return False
    if isinstance(a, float): return _num_equal(a,b,tolerance)
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(_values_equal(a[k], b[k], tolerance) for k in a)
    if isinstance(a, list):
        return len(a) == len(b) and all(_values_equal(x,y,tolerance) for x,y in zip(a,b))
    return a == b


class CBIMDiffEngine:
    """Semantic revision comparison for CBIM projects.

    Matching uses source provenance when present, otherwise stable CBIM IDs. Changes
    are categorized so viewer/issues/5D consumers do not need to reinterpret raw JSON.
    """
    def __init__(self, *, geometry_tolerance_m: float = 1e-5):
        if geometry_tolerance_m <= 0: raise ValueError('geometry_tolerance_m must be positive')
        self.tol = geometry_tolerance_m

    def compare(self, before: CBIMProject, after: CBIMProject) -> ProjectDiff:
        bmap = {_identity(e): e for e in before.elements}
        amap = {_identity(e): e for e in after.elements}
        changes: list[ElementChange] = []
        for key in sorted(bmap.keys() - amap.keys()):
            e=bmap[key]; changes.append(ElementChange(kind='removed', element_type=e.type, before_id=e.id, identity=key, categories=['existence']))
        for key in sorted(amap.keys() - bmap.keys()):
            e=amap[key]; changes.append(ElementChange(kind='added', element_type=e.type, after_id=e.id, identity=key, categories=['existence']))
        for key in sorted(bmap.keys() & amap.keys()):
            b,a=bmap[key],amap[key]; cats=[]; details={}
            bg,ag=_geometry_payload(b),_geometry_payload(a)
            if not _values_equal(bg,ag,self.tol): cats.append('geometry'); details['geometry']={'before':bg,'after':ag}
            if b.properties != a.properties: cats.append('properties'); details['properties']={'before':b.properties,'after':a.properties}
            if getattr(b,'system_id',None) != getattr(a,'system_id',None): cats.append('system'); details['system']={'before':getattr(b,'system_id',None),'after':getattr(a,'system_id',None)}
            if b.storey_id != a.storey_id: cats.append('storey'); details['storey']={'before':b.storey_id,'after':a.storey_id}
            if b.material_ids != a.material_ids: cats.append('materials'); details['materials']={'before':b.material_ids,'after':a.material_ids}
            if b.name != a.name: cats.append('name'); details['name']={'before':b.name,'after':a.name}
            if cats:
                changes.append(ElementChange(kind='modified',element_type=a.type,before_id=b.id,after_id=a.id,identity=key,categories=cats,details=details))
        counts={'added':0,'removed':0,'modified':0}
        for c in changes: counts[c.kind]+=1
        return ProjectDiff(before_project_id=before.id, after_project_id=after.id, changes=changes, counts=counts)
