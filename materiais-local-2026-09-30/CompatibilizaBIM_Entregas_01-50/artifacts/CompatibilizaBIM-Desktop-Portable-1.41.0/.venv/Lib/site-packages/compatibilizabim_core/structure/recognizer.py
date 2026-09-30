from __future__ import annotations
import math
from dataclasses import dataclass
from shapely.geometry import LineString
from shapely.strtree import STRtree
from shapely.ops import nearest_points
from cbim_sdk import CBIMProject
from cbim_sdk.models import Beam,Opening,Point3D,Slab,SourceRef
from ..cad.model import CadDocument,CadCircle,CadLine,CadPolyline

def tag(s,*tokens):return any(t in s.upper() for t in tokens)
def parallel(a,b):
    ax,ay=a.end.x-a.start.x,a.end.y-a.start.y;bx,by=b.end.x-b.start.x,b.end.y-b.start.y;la,lb=math.hypot(ax,ay),math.hypot(bx,by)
    return la>0 and lb>0 and abs(ax*by-ay*bx)/(la*lb)<1e-3
@dataclass(frozen=True)
class StructuralConfig:
    beam_default_height:float=.40;slab_default_thickness:float=.12;foundation_default_thickness:float=.40;opening_default_height:float=3.0;beam_max_width:float=1.5
class StructuralRecognizer:
    def __init__(self,config:StructuralConfig=StructuralConfig()):self.config=config
    def enrich(self,project:CBIMProject,document:CadDocument,progress=None)->CBIMProject:
        cfg=self.config;adds=[];used=set();lines=[e for e in document.entities if isinstance(e,CadLine) and tag(e.layer,'BEAM','VIGA')]
        geoms=[LineString([(e.start.x,e.start.y),(e.end.x,e.end.y)]) for e in lines];candidate_pairs=0
        if geoms:
            tree=STRtree(geoms);seen=set()
            for i,ga in enumerate(geoms):
                for j in tree.query(ga.buffer(cfg.beam_max_width,cap_style=2)):
                    j=int(j)
                    if j<=i or (i,j) in seen:continue
                    seen.add((i,j));candidate_pairs+=1;a,b=lines[i],lines[j]
                    if a.id in used or b.id in used or not parallel(a,b):continue
                    gb=geoms[j];width=ga.distance(gb)
                    if not .08<=width<=cfg.beam_max_width:continue
                    qa,qb=nearest_points(ga,gb);sx,sy=(qb.x-qa.x)/2,(qb.y-qa.y)/2;base=a if ga.length<=gb.length else b
                    adds.append(Beam(start=Point3D(x=base.start.x+sx,y=base.start.y+sy),end=Point3D(x=base.end.x+sx,y=base.end.y+sy),width=width,height=cfg.beam_default_height,confidence=.90,source_refs=[SourceRef(source_id=document.source_id,entity_id=a.id,layer=a.layer),SourceRef(source_id=document.source_id,entity_id=b.id,layer=b.layer)],properties={'structural':True}));used|={a.id,b.id}
        if progress:progress('structure_beam_candidates','done',None,{'beam_lines':len(lines),'candidate_pairs':candidate_pairs,'beams':sum(isinstance(e,Beam) for e in adds)})
        for e in document.entities:
            if isinstance(e,CadPolyline) and e.closed and tag(e.layer,'SLAB','LAJE','FOUNDATION','FUND','SAPATA','RADIER'):
                pts=[Point3D(x=p.x,y=p.y) for p in e.points]
                if len(pts)>=3:
                    role='foundation' if tag(e.layer,'FOUNDATION','FUND','SAPATA','RADIER') else 'slab';thick=cfg.foundation_default_thickness if role=='foundation' else cfg.slab_default_thickness
                    adds.append(Slab(boundary=pts,thickness=thick,confidence=.95,source_refs=[SourceRef(source_id=document.source_id,entity_id=e.id,layer=e.layer)],properties={'structural':True,'structural_role':role}))
            elif isinstance(e,CadCircle) and tag(e.layer,'OPENING','ABERT'):
                adds.append(Opening(position=Point3D(x=e.center.x,y=e.center.y),width=2*e.radius,height=cfg.opening_default_height,depth=2*e.radius,confidence=.90,source_refs=[SourceRef(source_id=document.source_id,entity_id=e.id,layer=e.layer)],properties={'shape':'circular'}))
        data=project.model_dump(mode='python',exclude_computed_fields=True);data['elements']=[e.model_dump(mode='python',exclude={'length'}) for e in project.elements+adds]
        return CBIMProject.model_validate(data)
