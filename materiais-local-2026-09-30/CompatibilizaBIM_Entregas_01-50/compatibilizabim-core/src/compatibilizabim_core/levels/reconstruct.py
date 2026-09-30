from dataclasses import dataclass,field
from cbim_sdk import CBIMProject
from cbim_sdk.models import Beam,Column,Door,Furniture,Opening,Pipe,Point3D,SanitaryTerminal,Slab,Space,Stair,Storey,Wall,Window
@dataclass(frozen=True)
class LevelDefinition:
    name:str; elevation:float; height:float; layer_patterns:tuple[str,...]=field(default_factory=tuple)
class Levels3DReconstructor:
    def apply(self,project:CBIMProject,levels:list[LevelDefinition])->CBIMProject:
        if not levels:raise ValueError('At least one level is required')
        levels=sorted(levels,key=lambda x:x.elevation); bid=project.buildings[0].id if project.buildings else None; storeys=[Storey(name=l.name,building_id=bid,elevation=l.elevation,height=l.height) for l in levels]
        def level_for(el):
            layers=' '.join((r.layer or '') for r in el.source_refs).upper()
            for i,l in enumerate(levels):
                if l.layer_patterns and any(p.upper() in layers for p in l.layer_patterns):return i
            return 0
        out=[]
        for el in project.elements:
            l=levels[level_for(el)]; s=storeys[level_for(el)]; d=el.model_dump(mode='python',exclude={'length'});d['storey_id']=s.id;z=l.elevation
            if isinstance(el,Wall):d.update(start=Point3D(x=el.start.x,y=el.start.y,z=z),end=Point3D(x=el.end.x,y=el.end.y,z=z),height=l.height)
            elif isinstance(el,Column):d.update(center=Point3D(x=el.center.x,y=el.center.y,z=z),height=l.height)
            elif isinstance(el,Beam):d.update(start=Point3D(x=el.start.x,y=el.start.y,z=z+l.height),end=Point3D(x=el.end.x,y=el.end.y,z=z+l.height))
            elif isinstance(el,Slab):d['boundary']=[Point3D(x=q.x,y=q.y,z=z) for q in el.boundary]
            elif isinstance(el,Stair):d.update(boundary=[Point3D(x=q.x,y=q.y,z=z) for q in el.boundary],height=l.height)
            elif isinstance(el,(SanitaryTerminal,Furniture)):d['position']=Point3D(x=el.position.x,y=el.position.y,z=z+el.position.z)
            elif isinstance(el,(Door,Window,Opening)):d['position']=Point3D(x=el.position.x,y=el.position.y,z=z+el.position.z)
            elif isinstance(el,Space):d.update(boundary=[Point3D(x=q.x,y=q.y,z=z) for q in el.boundary],height=l.height)
            elif isinstance(el,Pipe):d['path']=[Point3D(x=q.x,y=q.y,z=z+q.z) for q in el.path]
            out.append(type(el).model_validate(d))
        data=project.model_dump(mode='python',exclude_computed_fields=True);data['storeys']=[s.model_dump(mode='python') for s in storeys];data['elements']=[e.model_dump(mode='python',exclude={'length'}) for e in out]
        return CBIMProject.model_validate(data)
