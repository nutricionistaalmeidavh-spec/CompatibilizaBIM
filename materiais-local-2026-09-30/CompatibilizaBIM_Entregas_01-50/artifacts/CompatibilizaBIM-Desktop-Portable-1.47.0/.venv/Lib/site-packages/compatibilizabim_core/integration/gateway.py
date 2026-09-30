from __future__ import annotations
from pydantic import BaseModel,ConfigDict,Field
from cbim_sdk import CBIMProject
from cbim_sdk.models import Beam,Column,Equipment,Fitting,Pipe,Slab,Space,Wall
from ..quantities import QuantityCalculator,QuantitySummary
from ..connectivity import MEPConnectivityEngine

class IntegrationModel(BaseModel): model_config=ConfigDict(extra='forbid')
class ViewerPrimitive(IntegrationModel):
    element_id:str; type:str; storey_id:str|None=None; payload:dict=Field(default_factory=dict)
class CoreSnapshot(IntegrationModel):
    project_id:str; viewer:list[ViewerPrimitive]=Field(default_factory=list); issue_targets:list[str]=Field(default_factory=list); clash_candidates:list[str]=Field(default_factory=list); work_packages:dict[str,list[str]]=Field(default_factory=dict); quantities:QuantitySummary; network_count:int=0

class CoreIntegrationGateway:
    """Stable data boundary between CBIM and viewer/clash/issues/5D/4D modules.

    It does not embed a UI or clash solver. It produces deterministic, ID-stable
    snapshots that those existing/future modules can consume independently.
    """
    def __init__(self): self.qto=QuantityCalculator();self.networks=MEPConnectivityEngine()
    def snapshot(self,project:CBIMProject)->CoreSnapshot:
        viewer=[];clash=[];issues=[];packages={}
        for e in project.elements:
            payload={'confidence':e.confidence,'review_state':e.review_state}
            if isinstance(e,Wall):payload.update(start=e.start.model_dump(),end=e.end.model_dump(),thickness=e.thickness,height=e.height)
            elif isinstance(e,Column):payload.update(center=e.center.model_dump(),width=e.width,depth=e.depth,height=e.height)
            elif isinstance(e,Beam):payload.update(start=e.start.model_dump(),end=e.end.model_dump(),width=e.width,height=e.height)
            elif isinstance(e,Slab):payload.update(boundary=[p.model_dump() for p in e.boundary],thickness=e.thickness)
            elif isinstance(e,Pipe):payload.update(path=[p.model_dump() for p in e.path],diameter=e.diameter,system_id=e.system_id)
            elif isinstance(e,(Fitting,Equipment)):payload.update(position=e.position.model_dump(),system_id=e.system_id)
            elif isinstance(e,Space):payload.update(boundary=[p.model_dump() for p in e.boundary],height=e.height)
            else: payload.update(e.model_dump(exclude={'source_refs','properties'}))
            viewer.append(ViewerPrimitive(element_id=e.id,type=e.type,storey_id=e.storey_id,payload=payload))
            if e.type in {'wall','column','beam','slab','pipe','equipment'}: clash.append(e.id)
            if e.review_state!='confirmed' or e.confidence<.8: issues.append(e.id)
            key=e.storey_id or 'unassigned';packages.setdefault(key,[]).append(e.id)
        return CoreSnapshot(project_id=project.id,viewer=viewer,issue_targets=sorted(issues),clash_candidates=sorted(clash),work_packages={k:sorted(v) for k,v in sorted(packages.items())},quantities=self.qto.calculate(project),network_count=len(self.networks.build(project)))
