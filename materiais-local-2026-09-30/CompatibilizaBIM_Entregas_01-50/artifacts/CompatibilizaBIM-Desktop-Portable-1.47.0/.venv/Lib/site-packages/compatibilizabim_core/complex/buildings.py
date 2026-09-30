from __future__ import annotations
from collections import defaultdict
from pydantic import BaseModel,ConfigDict,Field,model_validator
from cbim_sdk import CBIMProject
from cbim_sdk.models import Site,Building,Storey

class ComplexModel(BaseModel):model_config=ConfigDict(extra='forbid')
class StoreySpec(ComplexModel):
    name:str;elevation:float;height:float=Field(gt=0);zone:str|None=None;template:str|None=None
class BuildingSpec(ComplexModel):
    name:str;code:str;storeys:list[StoreySpec]=Field(default_factory=list);properties:dict[str,str|int|float|bool|None]=Field(default_factory=dict)
    @model_validator(mode='after')
    def unique_storeys(self):
        if len({s.name for s in self.storeys})!=len(self.storeys):raise ValueError(f'duplicate storey names in {self.code}')
        return self
class ComplexProjectSpec(ComplexModel):
    name:str;site_name:str='Site';buildings:list[BuildingSpec]=Field(min_length=1)
    @model_validator(mode='after')
    def unique_buildings(self):
        if len({b.code for b in self.buildings})!=len(self.buildings):raise ValueError('building codes must be unique')
        return self
class StoreyPattern(ComplexModel):
    signature:str;storey_ids:list[str]=Field(default_factory=list);building_ids:list[str]=Field(default_factory=list)

class ComplexBuildingAssembler:
    """Create and maintain multi-building/multi-tower CBIM hierarchy."""
    def create(self,spec:ComplexProjectSpec)->CBIMProject:
        site=Site(name=spec.site_name);buildings=[];storeys=[]
        for bspec in spec.buildings:
            b=Building(name=bspec.name,site_id=site.id,properties={'code':bspec.code,**bspec.properties});buildings.append(b)
            for ss in bspec.storeys:
                props={'building_code':bspec.code}
                if ss.zone:props['zone']=ss.zone
                if ss.template:props['template']=ss.template
                storeys.append(Storey(name=ss.name,building_id=b.id,elevation=ss.elevation,height=ss.height,properties=props))
        return CBIMProject(name=spec.name,sites=[site],buildings=buildings,storeys=storeys,metadata={'complex_building':True,'building_count':len(buildings)})
    def assign(self,project:CBIMProject,assignments:dict[str,str])->CBIMProject:
        p=project.model_copy(deep=True);storeys={s.id for s in p.storeys}
        by={e.id:e for e in p.elements}
        for eid,sid in assignments.items():
            if eid not in by:raise KeyError(f'unknown element {eid}')
            if sid not in storeys:raise KeyError(f'unknown storey {sid}')
            by[eid].storey_id=sid
        return CBIMProject.model_validate(p.model_dump(exclude_computed_fields=True))

class RepeatPatternDetector:
    """Detect repeated/tipical floors using normalized semantic element signatures."""
    def signature(self,project:CBIMProject,storey_id:str)->str:
        storey=next(s for s in project.storeys if s.id==storey_id);els=[e for e in project.elements if e.storey_id==storey_id]
        counts=defaultdict(int);dims=[]
        for e in els:
            counts[e.type]+=1
            if e.type=='wall':dims.append(('wall',round(e.length,3),round(e.thickness,3),round(e.height,3)))
            elif e.type=='column':dims.append(('column',round(e.width,3),round(e.depth,3),round(e.height,3)))
            elif e.type=='pipe':dims.append(('pipe',round(e.diameter,4),getattr(e,'system_id',None)))
        template=storey.properties.get('template')
        core=(tuple(sorted(counts.items())),tuple(sorted(dims)))
        return repr((template,core))
    def detect(self,project:CBIMProject)->list[StoreyPattern]:
        groups=defaultdict(list)
        for s in project.storeys:groups[self.signature(project,s.id)].append(s)
        result=[]
        for sig,storeys in groups.items():
            if len(storeys)<2:continue
            result.append(StoreyPattern(signature=sig,storey_ids=sorted(s.id for s in storeys),building_ids=sorted(set(s.building_id for s in storeys if s.building_id))))
        return sorted(result,key=lambda p:(-len(p.storey_ids),p.signature))
