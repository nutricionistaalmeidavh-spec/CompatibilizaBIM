from __future__ import annotations
import math
import statistics
from time import perf_counter
from dataclasses import dataclass
from shapely.geometry import LineString,Point,MultiPoint
from shapely.strtree import STRtree
from shapely.ops import nearest_points
from cbim_sdk import CBIMProject
from cbim_sdk.models import Building,Column,Door,Furniture,Point3D,SanitaryTerminal,Site,Slab,SourceRef,Space,Stair,Wall,Window
from ..cad.model import CadDocument,CadInsert,CadLine,CadPolyline,CadText
from ..topology.model import TopologyGraph
from ..geometry.analysis import closed_contours

@dataclass(frozen=True)
class RecognitionConfig:
    wall_min_thickness:float=.05
    wall_max_thickness:float=.40
    wall_min_length:float=.30
    default_height:float=2.8
    default_door_height:float=2.1
    default_window_height:float=1.2
    host_tolerance:float=.35
    default_slab_thickness:float=.12
    wall_merge_tolerance:float=.10
    stair_min_treads:int=5
    stair_min_spacing:float=.12
    stair_max_spacing:float=.45

def tag(s,*tokens): return any(t in (s or '').upper() for t in tokens)
def parallel(a,b):
    ax,ay=a.end.x-a.start.x,a.end.y-a.start.y; bx,by=b.end.x-b.start.x,b.end.y-b.start.y; la,lb=math.hypot(ax,ay),math.hypot(bx,by)
    return la>0 and lb>0 and abs(ax*by-ay*bx)/(la*lb)<1e-3

def _wall_pair_geom(a,b,ga:LineString,gb:LineString,cfg):
    if not parallel(a,b): return None
    d=ga.distance(gb)
    if not cfg.wall_min_thickness<=d<=cfg.wall_max_thickness: return None
    dx,dy=a.end.x-a.start.x,a.end.y-a.start.y; L=math.hypot(dx,dy)
    if L<=1e-12:return None
    ux,uy=dx/L,dy/L
    def t(p): return (p[0]-a.start.x)*ux+(p[1]-a.start.y)*uy
    lo=max(0,min(t((b.start.x,b.start.y)),t((b.end.x,b.end.y)))); hi=min(L,max(t((b.start.x,b.start.y)),t((b.end.x,b.end.y))))
    if hi-lo<cfg.wall_min_length:return None
    qa,qb=nearest_points(ga,gb); sx,sy=(qb.x-qa.x)/2,(qb.y-qa.y)/2
    return (a.start.x+ux*lo+sx,a.start.y+uy*lo+sy),(a.start.x+ux*hi+sx,a.start.y+uy*hi+sy),d,hi-lo

def wall_pair(a,b,cfg):
    ga=LineString([(a.start.x,a.start.y),(a.end.x,a.end.y)]); gb=LineString([(b.start.x,b.start.y),(b.end.x,b.end.y)])
    return _wall_pair_geom(a,b,ga,gb,cfg)

def source_ref(document,e):
    original=str(e.metadata.get('source_entity_id',e.id));meta={}
    if original!=e.id:meta['generated_segment_id']=e.id
    return SourceRef(source_id=document.source_id,entity_id=original,layer=e.layer,metadata=meta)

def _block_bounds(doc,name):
    b=doc.blocks.get(name);xs=[];ys=[]
    if b:
        for e in b.entities:
            if isinstance(e,CadLine): xs += [e.start.x,e.end.x];ys += [e.start.y,e.end.y]
            elif isinstance(e,CadPolyline): xs += [p.x for p in e.points];ys += [p.y for p in e.points]
    if len(xs)>1 and len(ys)>1:return max(xs)-min(xs),max(ys)-min(ys)
    return .9,.6

def block_width(doc,name): return _block_bounds(doc,name)[0]

def _line_angle_len(e:CadLine):
    dx=e.end.x-e.start.x;dy=e.end.y-e.start.y
    length=math.hypot(dx,dy)
    if length<=1e-12:return 0.,0.
    angle=math.atan2(dy,dx)%math.pi
    return angle,length

def _detect_stairs(document:CadDocument, lines:list[CadLine], cfg:RecognitionConfig):
    """Detect regular tread-like repetitions before wall pairing.

    This is deliberately conservative: at least five similar parallel segments, regular
    spacing and tight alignment along the run are required. It prevents stair treads from
    being interpreted as dozens of independent walls without turning generic hatching into
    stairs.
    """
    buckets={}
    for e in lines:
        angle,length=_line_angle_len(e)
        if not .45<=length<=4.0:continue
        key=(round(math.degrees(angle)/3),round(length/.15))
        buckets.setdefault(key,[]).append(e)
    stairs=[];reserved=set()
    for group in buckets.values():
        if len(group)<cfg.stair_min_treads:continue
        angle,_=_line_angle_len(group[0]);ux,uy=math.cos(angle),math.sin(angle);nx,ny=-uy,ux
        rows=[]
        for e in group:
            mx=(e.start.x+e.end.x)/2;my=(e.start.y+e.end.y)/2;_,ln=_line_angle_len(e)
            rows.append((mx*nx+my*ny,mx*ux+my*uy,ln,e))
        rows.sort(key=lambda r:r[0]);seq=[]
        sequences=[]
        for row in rows:
            if not seq:seq=[row];continue
            gap=row[0]-seq[-1][0]
            if cfg.stair_min_spacing<=gap<=cfg.stair_max_spacing:seq.append(row)
            else:
                if len(seq)>=cfg.stair_min_treads:sequences.append(seq)
                seq=[row]
        if len(seq)>=cfg.stair_min_treads:sequences.append(seq)
        for seq in sequences:
            lengths=[r[2] for r in seq];gaps=[seq[i+1][0]-seq[i][0] for i in range(len(seq)-1)]
            med_len=statistics.median(lengths);med_gap=statistics.median(gaps)
            if med_len<=0 or med_gap<=0:continue
            if max(abs(v-med_len) for v in lengths)>med_len*.18:continue
            if max(abs(v-med_gap) for v in gaps)>med_gap*.20:continue
            along=[r[1] for r in seq]
            if max(along)-min(along)>max(.30,med_len*.30):continue
            pts=[]
            for *_,e in seq:pts.extend([(e.start.x,e.start.y),(e.end.x,e.end.y)])
            rect=MultiPoint(pts).minimum_rotated_rectangle
            coords=list(rect.exterior.coords)[:-1]
            if len(coords)<3:continue
            src=[source_ref(document,r[3]) for r in seq]
            stair=Stair(boundary=[Point3D(x=float(x),y=float(y)) for x,y in coords],width=med_len,riser_count=len(seq),tread_depth=med_gap,height=cfg.default_height,direction_deg=math.degrees(angle),confidence=.88,source_refs=src,properties={'recognition':'regular_tread_pattern','requires_review':True})
            stairs.append(stair);reserved.update(r[3].id for r in seq)
    return stairs,reserved

def _wall_angle(w:Wall):
    return math.atan2(w.end.y-w.start.y,w.end.x-w.start.x)%math.pi

def _merge_two_walls(a:Wall,b:Wall,tol:float):
    if abs(a.thickness-b.thickness)>.02:return None
    aa=_wall_angle(a);bb=_wall_angle(b)
    if abs(math.sin(aa-bb))>.02:return None
    ga=LineString([(a.start.x,a.start.y),(a.end.x,a.end.y)]);gb=LineString([(b.start.x,b.start.y),(b.end.x,b.end.y)])
    if ga.distance(gb)>.04:return None
    ux,uy=math.cos(aa),math.sin(aa);ox,oy=a.start.x,a.start.y
    vals=[]
    for q in (a.start,a.end,b.start,b.end):vals.append(((q.x-ox)*ux+(q.y-oy)*uy,q))
    vals.sort(key=lambda x:x[0])
    # Require touching/overlapping projections; do not bridge architectural gaps.
    ia=sorted(((a.start.x-ox)*ux+(a.start.y-oy)*uy,(a.end.x-ox)*ux+(a.end.y-oy)*uy));ib=sorted(((b.start.x-ox)*ux+(b.start.y-oy)*uy,(b.end.x-ox)*ux+(b.end.y-oy)*uy))
    gap=max(ib[0]-ia[1],ia[0]-ib[1],0.)
    if gap>tol:return None
    t0,t1=vals[0][0],vals[-1][0]
    start=Point3D(x=ox+ux*t0,y=oy+uy*t0,z=min(a.start.z,b.start.z));end=Point3D(x=ox+ux*t1,y=oy+uy*t1,z=min(a.end.z,b.end.z))
    return Wall(start=start,end=end,thickness=(a.thickness+b.thickness)/2,height=max(a.height,b.height),confidence=min(a.confidence,b.confidence),source_refs=a.source_refs+b.source_refs,properties={**a.properties,'merged_wall_fragments':True})

def _merge_walls(walls:list[Wall],tol:float):
    pending=list(walls);out=[]
    while pending:
        cur=pending.pop(0);changed=True
        while changed:
            changed=False
            for i,other in enumerate(pending):
                merged=_merge_two_walls(cur,other,tol)
                if merged is not None:
                    cur=merged;pending.pop(i);changed=True;break
        out.append(cur)
    return out

def _terminal_type(label:str):
    up=label.upper()
    if tag(up,'PIA','CUBA','SINK'):return 'sink'
    if tag(up,'LAVATORIO','LAVATÓRIO','LAVABO'):return 'lavatory'
    if tag(up,'VASO','BACIA','TOILET','WC'):return 'toilet'
    if tag(up,'MICTORIO','MICTÓRIO','URINAL'):return 'urinal'
    if tag(up,'CHUVEIRO','SHOWER'):return 'shower'
    if tag(up,'TANQUE'):return 'tank'
    return 'other'

class ArchitectureRecognizer:
    def __init__(self,config:RecognitionConfig=RecognitionConfig()): self.config=config
    def recognize(self,document:CadDocument,topology:TopologyGraph,*,project_name='Imported CAD',progress=None)->CBIMProject:
        cfg=self.config; p=CBIMProject(name=project_name,sites=[Site(name='Local Site')],buildings=[Building(name='Building')]); walls=[]; used=set(); candidates=[]

        # Composite objects are recognized before walls so their source primitives are reserved.
        wall_source=[e for e in document.entities if isinstance(e,CadLine) and tag(e.layer,'WALL','PAREDE','ALV')]
        stairs,stair_used=_detect_stairs(document,wall_source,cfg);p.elements.extend(stairs);used|=stair_used
        p.metadata['architecture_stair_count']=len(stairs);p.metadata['architecture_stair_reserved_line_count']=len(stair_used)

        # Floors/slabs: direct closed polylines first, then closed contours built from PISOS/LAJE linework.
        slab_keys=set()
        for e in document.entities:
            if isinstance(e,CadPolyline) and e.closed and tag(e.layer,'PISO','FLOOR','LAJE','SLAB'):
                poly=LineString([(q.x,q.y) for q in e.points+[e.points[0]]]).buffer(0)
                xs=[q.x for q in e.points];ys=[q.y for q in e.points]
                if (max(xs)-min(xs))*(max(ys)-min(ys))<.5:continue
                key=tuple(round(v,5) for v in (min(xs),min(ys),max(xs),max(ys)))
                if key in slab_keys:continue
                slab_keys.add(key);used.add(e.id)
                p.elements.append(Slab(boundary=[Point3D(x=q.x,y=q.y,z=q.z) for q in e.points],thickness=cfg.default_slab_thickness,confidence=.94,source_refs=[source_ref(document,e)],properties={'recognition':'floor_layer_closed_polyline'}))
        floor_lines=[e for e in document.entities if isinstance(e,CadLine) and tag(e.layer,'PISO','FLOOR','LAJE','SLAB')]
        for poly in closed_contours(floor_lines):
            if poly.area<.5:continue
            key=tuple(round(v,5) for v in poly.bounds)
            if key in slab_keys:continue
            slab_keys.add(key);coords=list(poly.exterior.coords)[:-1]
            p.elements.append(Slab(boundary=[Point3D(x=float(x),y=float(y)) for x,y in coords],thickness=cfg.default_slab_thickness,confidence=.80,source_refs=[],properties={'recognition':'floor_layer_closed_contour','requires_review':True}))
        p.metadata['architecture_slab_count']=sum(1 for e in p.elements if isinstance(e,Slab))

        # Sanitary fixtures and casework/counters are higher-level objects, never walls.
        for e in document.entities:
            label=f'{e.layer} {getattr(e,"block_name","")}'
            if isinstance(e,CadInsert) and tag(label,'PIA','CUBA','SINK','LAVATORIO','LAVATÓRIO','VASO','BACIA','TOILET','MICTORIO','MICTÓRIO','CHUVEIRO','SHOWER','TANQUE'):
                w,d=_block_bounds(document,e.block_name);w=max(.2,w*abs(e.xscale));d=max(.2,d*abs(e.yscale))
                p.elements.append(SanitaryTerminal(position=Point3D(x=e.position.x,y=e.position.y,z=e.position.z),terminal_type=_terminal_type(label),width=w,depth=d,height=.85,rotation_deg=e.rotation_deg,confidence=.94,source_refs=[source_ref(document,e)],properties={'recognition':'sanitary_block'}));used.add(e.id)
            elif isinstance(e,CadInsert) and tag(label,'BALCAO','BALCÃO','BANCADA','COUNTER','CABINET','ARMARIO','ARMÁRIO'):
                w,d=_block_bounds(document,e.block_name);w=max(.2,w*abs(e.xscale));d=max(.2,d*abs(e.yscale))
                p.elements.append(Furniture(position=Point3D(x=e.position.x,y=e.position.y,z=e.position.z),furniture_type='counter',width=w,depth=d,height=.90,rotation_deg=e.rotation_deg,confidence=.92,source_refs=[source_ref(document,e)],properties={'recognition':'casework_block'}));used.add(e.id)
            elif isinstance(e,CadPolyline) and e.closed and tag(e.layer,'PIA','CUBA','LAVATORIO','LAVATÓRIO','BANCADA','BALCAO','BALCÃO','COUNTER','CABINET'):
                xs=[q.x for q in e.points];ys=[q.y for q in e.points];w=max(xs)-min(xs);d=max(ys)-min(ys)
                if w<.15 or d<.15:continue
                pos=Point3D(x=(max(xs)+min(xs))/2,y=(max(ys)+min(ys))/2,z=min(q.z for q in e.points))
                if tag(e.layer,'PIA','CUBA','LAVATORIO','LAVATÓRIO'):
                    p.elements.append(SanitaryTerminal(position=pos,terminal_type=_terminal_type(e.layer),width=w,depth=d,height=.85,confidence=.86,source_refs=[source_ref(document,e)],properties={'recognition':'sanitary_closed_polyline','requires_review':True}))
                else:
                    p.elements.append(Furniture(position=pos,furniture_type='counter',width=w,depth=d,height=.90,confidence=.86,source_refs=[source_ref(document,e)],properties={'recognition':'casework_closed_polyline','requires_review':True}))
                used.add(e.id)

        wall_candidates_started=perf_counter()
        lines=[e for e in wall_source if e.id not in used]
        geoms=[LineString([(e.start.x,e.start.y),(e.end.x,e.end.y)]) for e in lines]
        candidate_pairs=0
        if geoms:
            tree=STRtree(geoms);seen=set()
            for i,ga in enumerate(geoms):
                for j in tree.query(ga.buffer(cfg.wall_max_thickness,cap_style=2)):
                    j=int(j)
                    if j<=i or (i,j) in seen:continue
                    seen.add((i,j));candidate_pairs+=1
                    r=_wall_pair_geom(lines[i],lines[j],ga,geoms[j],cfg)
                    if r:candidates.append((r[3],lines[i],lines[j],r))
        if progress: progress('architecture_wall_candidates','done',perf_counter()-wall_candidates_started,{'wall_lines':len(lines),'candidate_pairs':candidate_pairs,'matched_pairs':len(candidates)})
        for _,a,b,r in sorted(candidates,key=lambda x:-x[0]):
            if a.id in used or b.id in used:continue
            used|={a.id,b.id}; s,e,t,_=r
            walls.append(Wall(start=Point3D(x=s[0],y=s[1]),end=Point3D(x=e[0],y=e[1]),thickness=t,height=cfg.default_height,confidence=.96,source_refs=[source_ref(document,a),source_ref(document,b)]))
        walls=_merge_walls(walls,cfg.wall_merge_tolerance);p.elements.extend(walls);p.metadata['architecture_wall_count']=len(walls)

        for e in document.entities:
            if isinstance(e,CadPolyline) and e.closed and tag(e.layer,'COLUMN','PILAR'):
                xs=[q.x for q in e.points];ys=[q.y for q in e.points]; w,d=max(xs)-min(xs),max(ys)-min(ys)
                if w>0 and d>0:p.elements.append(Column(center=Point3D(x=(max(xs)+min(xs))/2,y=(max(ys)+min(ys))/2),width=w,depth=d,height=cfg.default_height,confidence=.97,source_refs=[source_ref(document,e)],properties={'structural':True}))
        wall_geoms=[LineString([(w.start.x,w.start.y),(w.end.x,w.end.y)]) for w in walls];wall_tree=STRtree(wall_geoms) if wall_geoms else None
        for e in document.entities:
            if not isinstance(e,CadInsert):continue
            label=f'{e.layer} {e.block_name}'
            if not tag(label,'DOOR','PORTA','WINDOW','JANELA'):continue
            width=max(.1,block_width(document,e.block_name)*abs(e.xscale)); point=Point(e.position.x,e.position.y); host=None; best=1e9
            if wall_tree is not None:
                for idx in wall_tree.query(point.buffer(cfg.host_tolerance)):
                    idx=int(idx);d=wall_geoms[idx].distance(point)
                    if d<=cfg.host_tolerance and d<best:host,best=walls[idx].id,d
            common=dict(position=Point3D(x=e.position.x,y=e.position.y),width=width,host_id=host,rotation_deg=e.rotation_deg,confidence=.95,source_refs=[source_ref(document,e)])
            if tag(label,'DOOR','PORTA'):p.elements.append(Door(height=cfg.default_door_height,**common))
            elif tag(label,'WINDOW','JANELA'):p.elements.append(Window(height=cfg.default_window_height,sill_height=1.0,**common))
        texts=[e for e in document.entities if isinstance(e,CadText) and e.text.strip()]
        polys=[poly for poly in closed_contours(lines) if poly.area>=.5]
        selected=[]
        if texts and polys:
            poly_tree=STRtree(polys)
            for t in texts:
                pt=Point(t.position.x,t.position.y);hits=[polys[int(i)] for i in poly_tree.query(pt) if polys[int(i)].covers(pt)]
                if hits:selected.append((min(hits,key=lambda poly:poly.area),t.text.strip()))
        else:selected=[(poly,None) for poly in polys]
        seen=set()
        for poly,name in selected:
            key=tuple(round(v,6) for v in poly.bounds)
            if key in seen:continue
            seen.add(key);boundary=[(float(x),float(y)) for x,y in list(poly.exterior.coords)[:-1]]
            p.elements.append(Space(name=name,boundary=[Point3D(x=x,y=y) for x,y in boundary],height=cfg.default_height,confidence=.92 if name else .72,source_refs=[]))
        return p
