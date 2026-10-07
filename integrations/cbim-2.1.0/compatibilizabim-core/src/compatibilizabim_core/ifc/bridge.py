from __future__ import annotations
import base64, math, re, uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from cbim_sdk import CBIMProject
from cbim_sdk.models import Beam,Column,Door,Equipment,Fitting,Furniture,Pipe,SanitaryTerminal,Slab,Stair,Wall,Window

_PAYLOAD_RE=re.compile(r"/\*CBIM_PAYLOAD_BASE64:([A-Za-z0-9+/=]+)\*/")
_IFC64="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"


def _s(v:str|None)->str:
    return "$" if v is None else "'"+v.replace("'","''")+"'"
def _guid(seed:str)->str:
    n=uuid.uuid5(uuid.NAMESPACE_URL,seed).int; chars=[]
    for _ in range(22): chars.append(_IFC64[n%64]); n//=64
    return ''.join(reversed(chars))
class _Step:
    def __init__(self): self.rows=[]
    def add(self,e:str)->int: self.rows.append(e); return len(self.rows)
def _axis(s:_Step,x:float,y:float,z:float=0.,angle:float=0.)->int:
    p=s.add(f"IFCCARTESIANPOINT(({x:.9g},{y:.9g},{z:.9g}))"); zd=s.add("IFCDIRECTION((0.,0.,1.))"); xd=s.add(f"IFCDIRECTION(({math.cos(angle):.9g},{math.sin(angle):.9g},0.))"); return s.add(f"IFCAXIS2PLACEMENT3D(#{p},#{zd},#{xd})")
def _box_shape(s:_Step,ctx:int,x:float,y:float,z:float)->int:
    a=_axis(s,0,0,0); b=s.add(f"IFCBLOCK(#{a},{max(x,1e-6):.9g},{max(y,1e-6):.9g},{max(z,1e-6):.9g})"); r=s.add(f"IFCSHAPEREPRESENTATION(#{ctx},'Body','CSG',(#{b}))"); return s.add(f"IFCPRODUCTDEFINITIONSHAPE($,$,(#{r}))")
def _poly_shape(s:_Step,ctx:int,coords:list[tuple[float,float]],thickness:float)->int:
    points=[s.add(f"IFCCARTESIANPOINT(({x:.9g},{y:.9g}))") for x,y in coords]
    if len(points)>=2: points.append(points[0])
    poly=s.add("IFCPOLYLINE(("+','.join(f'#{p}' for p in points)+"))"); profile=s.add(f"IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#{poly})"); pos=_axis(s,0,0,0); d=s.add("IFCDIRECTION((0.,0.,1.))"); solid=s.add(f"IFCEXTRUDEDAREASOLID(#{profile},#{pos},#{d},{max(thickness,1e-6):.9g})"); rep=s.add(f"IFCSHAPEREPRESENTATION(#{ctx},'Body','SweptSolid',(#{solid}))"); return s.add(f"IFCPRODUCTDEFINITIONSHAPE($,$,(#{rep}))")
def _swept_disk_shape(s:_Step,ctx:int,segments,diameter:float)->int:
    solids=[]
    for a,b in segments:
        ax,ay,az=(a.x,a.y,a.z) if hasattr(a,'x') else a;bx,by,bz=(b.x,b.y,b.z) if hasattr(b,'x') else b
        if math.dist((ax,ay,az),(bx,by,bz))<=1e-9:continue
        p1=s.add(f"IFCCARTESIANPOINT(({ax:.9g},{ay:.9g},{az:.9g}))");p2=s.add(f"IFCCARTESIANPOINT(({bx:.9g},{by:.9g},{bz:.9g}))")
        curve=s.add(f"IFCPOLYLINE((#{p1},#{p2}))");solids.append(s.add(f"IFCSWEPTDISKSOLID(#{curve},{max(diameter/2,1e-6):.9g},$,$,$)"))
    if not solids:return _box_shape(s,ctx,max(diameter,1e-3),max(diameter,1e-3),max(diameter,1e-3))
    rep=s.add(f"IFCSHAPEREPRESENTATION(#{ctx},'Body','SweptSolid',("+','.join(f'#{solid}' for solid in solids)+"))");return s.add(f"IFCPRODUCTDEFINITIONSHAPE($,$,(#{rep}))")

def _pipe_shape(s:_Step,ctx:int,a,b,diameter:float)->int:
    # True circular pipe geometry for IFC viewers/Revit. Each CBIM path leg is one swept disk.
    return _swept_disk_shape(s,ctx,[(a,b)],diameter)

def _pipe_directions_at(pipe:Pipe,position,tol:float=.05):
    dirs=[]
    for a,b in zip(pipe.path,pipe.path[1:]):
        for node,other in ((a,b),(b,a)):
            if math.dist((node.x,node.y,node.z),(position.x,position.y,position.z))>tol:continue
            vx,vy,vz=other.x-node.x,other.y-node.y,other.z-node.z;L=math.sqrt(vx*vx+vy*vy+vz*vz)
            if L<=1e-9:continue
            u=(vx/L,vy/L,vz/L)
            if not any(sum(x*y for x,y in zip(u,v))>.999 for v in dirs):dirs.append(u)
    return dirs

def _fitting_shape(s:_Step,ctx:int,fitting:Fitting,pipes_by_id:dict[str,Pipe])->int:
    d=fitting.nominal_diameter or .05;ids=[x.strip() for x in str(fitting.properties.get('connected_pipe_ids','')).split(',') if x.strip()]
    dirs=[]
    for pid in ids:
        pipe=pipes_by_id.get(pid)
        if not pipe:continue
        for u in _pipe_directions_at(pipe,fitting.position,max(.05,d*2)):
            if not any(sum(x*y for x,y in zip(u,v))>.999 for v in dirs):dirs.append(u)
    # Preserve fitting semantics even when CAD did not expose ports: a short circular body is
    # preferable to the historical square proxy and remains clearly distinguishable from pipe.
    if not dirs:dirs=[(1.,0.,0.),(-1.,0.,0.)]
    arm=max(.03,d*1.5);c=(fitting.position.x,fitting.position.y,fitting.position.z)
    segments=[(c,(c[0]+u[0]*arm,c[1]+u[1]*arm,c[2]+u[2]*arm)) for u in dirs]
    return _swept_disk_shape(s,ctx,segments,d)

def _ifc_value(v):
    if v is None:return '$'
    if isinstance(v,bool):return f"IFCBOOLEAN({'.T.' if v else '.F.'})"
    if isinstance(v,int):return f"IFCINTEGER({v})"
    if isinstance(v,float):return f"IFCREAL({v:.9g})"
    return f"IFCLABEL({_s(str(v))})"
def _attach_pset(s:_Step,owner:int,product:int,seed:str,props:dict,name='CompatibilizaBIM'):
    clean={str(k):v for k,v in props.items() if isinstance(v,(str,int,float,bool)) or v is None}
    if not clean:return
    rows=[s.add(f"IFCPROPERTYSINGLEVALUE({_s(k)},$,{_ifc_value(v)},$)") for k,v in sorted(clean.items())]
    ps=s.add(f"IFCPROPERTYSET('{_guid(seed+':pset:'+name)}',#{owner},{_s(name)},$,("+','.join(f'#{r}' for r in rows)+"))")
    s.add(f"IFCRELDEFINESBYPROPERTIES('{_guid(seed+':pset-rel:'+name)}',#{owner},$,$,(#{product}),#{ps})")
def _attach_qto(s:_Step,owner:int,product:int,seed:str,quantities:dict[str,tuple[str,float]]):
    rows=[]
    for name,(kind,value) in quantities.items():
        if value is None or not math.isfinite(float(value)):continue
        entity={'length':'IFCQUANTITYLENGTH','area':'IFCQUANTITYAREA','volume':'IFCQUANTITYVOLUME','count':'IFCQUANTITYCOUNT'}.get(kind)
        if not entity:continue
        rows.append(s.add(f"{entity}({_s(name)},$,$,{float(value):.9g},$)"))
    if not rows:return
    q=s.add(f"IFCELEMENTQUANTITY('{_guid(seed+':qto')}',#{owner},'BaseQuantities',$,$,("+','.join(f'#{r}' for r in rows)+"))")
    s.add(f"IFCRELDEFINESBYPROPERTIES('{_guid(seed+':qto-rel')}',#{owner},$,$,(#{product}),#{q})")
def _poly_area(coords):
    if len(coords)<3:return 0.
    return abs(sum(coords[i][0]*coords[(i+1)%len(coords)][1]-coords[(i+1)%len(coords)][0]*coords[i][1] for i in range(len(coords)))/2)
def _common_props(e):
    props={'CBIMId':e.id,'CBIMType':e.type,'Confidence':float(e.confidence),**dict(e.properties)}
    if isinstance(e,Wall):props.update({'Length':e.length,'Thickness':e.thickness,'Height':e.height})
    elif isinstance(e,Pipe):props.update({'NominalDiameter':e.diameter,'SystemId':e.system_id or '', 'Slope':e.slope})
    elif isinstance(e,Fitting):props.update({'FittingType':e.fitting_type,'NominalDiameter':e.nominal_diameter or 0.,'SystemId':e.system_id or ''})
    elif isinstance(e,Stair):props.update({'RiserCount':e.riser_count,'TreadDepth':e.tread_depth,'Width':e.width,'Height':e.height})
    elif isinstance(e,SanitaryTerminal):props.update({'TerminalType':e.terminal_type,'Width':e.width,'Depth':e.depth,'Height':e.height})
    elif isinstance(e,Furniture):props.update({'FurnitureType':e.furniture_type,'Width':e.width,'Depth':e.depth,'Height':e.height})
    return props

def _equipment_class(e:Equipment):
    label=f'{e.name or ""} {e.equipment_type}'.upper()
    if any(t in label for t in ('REGISTRO','VALVE','VÁLVULA','VALVULA')):return 'valve'
    return 'proxy'

class IFCBridge:
    """IFC4 exporter with a legacy STEP fallback and optional IfcOpenShell backend."""
    def __init__(self,backend:str='legacy'):
        if backend not in {'legacy','ifcopenshell','auto'}: raise ValueError("backend must be legacy, ifcopenshell or auto")
        self.backend=backend
    def export(self,project:CBIMProject,path:str|Path)->Path:
        backend=self.backend
        if backend=='auto':
            try:
                from .ifcopenshell_backend import available
                backend='ifcopenshell' if available() else 'legacy'
            except Exception: backend='legacy'
        if backend=='ifcopenshell':
            from .ifcopenshell_backend import IfcOpenShellBridge
            return IfcOpenShellBridge().export(project,path)
        return self._export_legacy(project,path)
    def _export_legacy(self,project:CBIMProject,path:str|Path)->Path:
        target=Path(path); s=_Step(); person=s.add("IFCPERSON($,$,'CompatibilizaBIM',$,$,$,$,$)"); org=s.add("IFCORGANIZATION($,'CompatibilizaBIM',$,$,$)"); pao=s.add(f"IFCPERSONANDORGANIZATION(#{person},#{org},$");s.rows[-1]=f"IFCPERSONANDORGANIZATION(#{person},#{org},$)"
        app=s.add(f"IFCAPPLICATION(#{org},'1.47.0','CompatibilizaBIM','CBIM')"); now=int(datetime.now(timezone.utc).timestamp()); owner=s.add(f"IFCOWNERHISTORY(#{pao},#{app},$,.ADDED.,$,$,$,{now})"); unit=s.add("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)"); units=s.add(f"IFCUNITASSIGNMENT((#{unit}))"); origin=_axis(s,0,0,0); ctx=s.add(f"IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#{origin},$");s.rows[-1]=f"IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#{origin},$)"; pjt=s.add(f"IFCPROJECT('{_guid(project.id)}',#{owner},{_s(project.name)},$,$,$,$,(#{ctx}),#{units})")
        site_obj=project.sites[0] if project.sites else None; site_axis=_axis(s,0,0,site_obj.elevation if site_obj else 0); site_place=s.add(f"IFCLOCALPLACEMENT($,#{site_axis})"); site=s.add(f"IFCSITE('{_guid(site_obj.id if site_obj else project.id+'site')}',#{owner},{_s(site_obj.name if site_obj else 'Site')},$,$,#{site_place},$,$,.ELEMENT.,$,$,$,$,$)"); s.add(f"IFCRELAGGREGATES('{_guid(project.id+'site-rel')}',#{owner},$,$,#{pjt},(#{site}))")
        b=project.buildings[0] if project.buildings else None; baxis=_axis(s,0,0,0); bplace=s.add(f"IFCLOCALPLACEMENT(#{site_place},#{baxis})"); building=s.add(f"IFCBUILDING('{_guid(b.id if b else project.id+'building')}',#{owner},{_s(b.name if b else 'Building')},$,$,#{bplace},$,$,.ELEMENT.,$,$,$)"); s.add(f"IFCRELAGGREGATES('{_guid(project.id+'building-rel')}',#{owner},$,$,#{site},(#{building}))")
        storeys={}
        for st in project.storeys:
            sax=_axis(s,0,0,st.elevation); spl=s.add(f"IFCLOCALPLACEMENT(#{bplace},#{sax})"); ref=s.add(f"IFCBUILDINGSTOREY('{_guid(st.id)}',#{owner},{_s(st.name)},$,$,#{spl},$,$,.ELEMENT.,{st.elevation:.9g})"); s.add(f"IFCRELAGGREGATES('{_guid(st.id+'-rel')}',#{owner},$,$,#{building},(#{ref}))"); storeys[st.id]=ref
        if not storeys:
            sax=_axis(s,0,0,0); spl=s.add(f"IFCLOCALPLACEMENT(#{bplace},#{sax})"); ref=s.add(f"IFCBUILDINGSTOREY('{_guid(project.id+'storey')}',#{owner},'Storey',$,$,#{spl},$,$,.ELEMENT.,0.)"); s.add(f"IFCRELAGGREGATES('{_guid(project.id+'storey-rel')}',#{owner},$,$,#{building},(#{ref}))"); storeys[None]=ref
        contained={v:[] for v in storeys.values()}; first=next(iter(storeys.values()))
        ifc_systems={};system_members=defaultdict(list)
        for sys in project.systems:
            ref=s.add(f"IFCDISTRIBUTIONSYSTEM('{_guid(sys.id)}',#{owner},{_s(sys.name)},{_s(sys.classification or sys.discipline)},$,$,.NOTDEFINED.)");ifc_systems[sys.id]=ref
            _attach_pset(s,owner,ref,sys.id,{'Discipline':sys.discipline,'Classification':sys.classification or ''},name='CompatibilizaBIM_System')
        pipes_by_id={e.id:e for e in project.elements if isinstance(e,Pipe)}
        for e in project.elements:
            ent=None;quant={};seed=e.id
            if isinstance(e,Wall):
                dx,dy=e.end.x-e.start.x,e.end.y-e.start.y; length=math.hypot(dx,dy); ax=_axis(s,e.start.x,e.start.y,e.start.z,math.atan2(dy,dx)); lp=s.add(f"IFCLOCALPLACEMENT($,#{ax})"); shape=_box_shape(s,ctx,length,e.thickness,e.height); ent=s.add(f"IFCWALL('{_guid(e.id)}',#{owner},{_s(e.name or e.id)},$,$,#{lp},#{shape},$,.STANDARD.)");quant={'Length':('length',length),'Width':('length',e.thickness),'Height':('length',e.height),'NetSideArea':('area',length*e.height),'NetVolume':('volume',length*e.thickness*e.height)}
            elif isinstance(e,Column):
                ax=_axis(s,e.center.x-e.width/2,e.center.y-e.depth/2,e.center.z,math.radians(e.rotation_deg)); lp=s.add(f"IFCLOCALPLACEMENT($,#{ax})"); shape=_box_shape(s,ctx,e.width,e.depth,e.height); ent=s.add(f"IFCCOLUMN('{_guid(e.id)}',#{owner},{_s(e.name or e.id)},$,$,#{lp},#{shape},$,.COLUMN.)");quant={'Width':('length',e.width),'Depth':('length',e.depth),'Height':('length',e.height),'NetVolume':('volume',e.width*e.depth*e.height)}
            elif isinstance(e,Beam):
                dx,dy=e.end.x-e.start.x,e.end.y-e.start.y; L=math.hypot(dx,dy); ax=_axis(s,e.start.x,e.start.y,e.start.z,math.atan2(dy,dx)); lp=s.add(f"IFCLOCALPLACEMENT($,#{ax})"); shape=_box_shape(s,ctx,L,e.width,e.height); ent=s.add(f"IFCBEAM('{_guid(e.id)}',#{owner},{_s(e.name or e.id)},$,$,#{lp},#{shape},$,.BEAM.)");quant={'Length':('length',L),'Width':('length',e.width),'Height':('length',e.height),'NetVolume':('volume',L*e.width*e.height)}
            elif isinstance(e,Slab):
                z=min(p.z for p in e.boundary); ax=_axis(s,0,0,z); lp=s.add(f"IFCLOCALPLACEMENT($,#{ax})"); coords=[(p.x,p.y) for p in e.boundary];shape=_poly_shape(s,ctx,coords,e.thickness); ent=s.add(f"IFCSLAB('{_guid(e.id)}',#{owner},{_s(e.name or e.id)},$,$,#{lp},#{shape},$,.FLOOR.)");area=_poly_area(coords);quant={'NetArea':('area',area),'Thickness':('length',e.thickness),'NetVolume':('volume',area*e.thickness)}
            elif isinstance(e,Stair):
                xs=[p.x for p in e.boundary];ys=[p.y for p in e.boundary];z=min(p.z for p in e.boundary);ax=_axis(s,min(xs),min(ys),z,math.radians(e.direction_deg));lp=s.add(f"IFCLOCALPLACEMENT($,#{ax})");shape=_box_shape(s,ctx,max(xs)-min(xs),max(ys)-min(ys),e.height);ent=s.add(f"IFCSTAIR('{_guid(e.id)}',#{owner},{_s(e.name or e.id)},$,$,#{lp},#{shape},$,.STRAIGHT_RUN_STAIR.)");quant={'Width':('length',e.width),'Height':('length',e.height),'RiserCount':('count',e.riser_count)}
            elif isinstance(e,(Door,Window)):
                ax=_axis(s,e.position.x,e.position.y,e.position.z,math.radians(e.rotation_deg)); lp=s.add(f"IFCLOCALPLACEMENT($,#{ax})"); shape=_box_shape(s,ctx,e.width,float(e.properties.get('depth',.12) or .12),e.height)
                if isinstance(e,Door): ent=s.add(f"IFCDOOR('{_guid(e.id)}',#{owner},{_s(e.name or e.id)},$,$,#{lp},#{shape},$,{e.height:.9g},{e.width:.9g},.DOOR.,.NOTDEFINED.,$)")
                else: ent=s.add(f"IFCWINDOW('{_guid(e.id)}',#{owner},{_s(e.name or e.id)},$,$,#{lp},#{shape},$,{e.height:.9g},{e.width:.9g},.WINDOW.,.NOTDEFINED.,$)")
                quant={'Width':('length',e.width),'Height':('length',e.height)}
            elif isinstance(e,Pipe):
                pipe_parts=[]
                for seg_i,(a,bp) in enumerate(zip(e.path,e.path[1:]),1):
                    length=math.dist((a.x,a.y,a.z),(bp.x,bp.y,bp.z))
                    if length<=1e-9: continue
                    lp=s.add(f"IFCLOCALPLACEMENT($,#{_axis(s,0,0,0)})");shape=_pipe_shape(s,ctx,a,bp,e.diameter);part=s.add(f"IFCPIPESEGMENT('{_guid(e.id+':'+str(seg_i))}',#{owner},{_s((e.name or e.id)+':'+str(seg_i))},$,$,#{lp},#{shape},$,.RIGIDSEGMENT.)");pipe_parts.append(part)
                    props=_common_props(e)|{'SegmentIndex':seg_i,'SegmentLength':length};_attach_pset(s,owner,part,e.id+':'+str(seg_i),props)
                    area=math.pi*(e.diameter/2)**2;_attach_qto(s,owner,part,e.id+':'+str(seg_i),{'Length':('length',length),'OuterDiameter':('length',e.diameter),'CrossSectionArea':('area',area),'NetVolume':('volume',area*length)})
                if pipe_parts:
                    st=storeys.get(e.storey_id,first); contained.setdefault(st,[]).extend(pipe_parts)
                    if e.system_id in ifc_systems:system_members[e.system_id].extend(pipe_parts)
                continue
            elif isinstance(e,Fitting):
                d=e.nominal_diameter or .05; ax=_axis(s,0,0,0); lp=s.add(f"IFCLOCALPLACEMENT($,#{ax})"); shape=_fitting_shape(s,ctx,e,pipes_by_id); ent=s.add(f"IFCPIPEFITTING('{_guid(e.id)}',#{owner},{_s(e.name or e.id)},$,$,#{lp},#{shape},$,.NOTDEFINED.)");quant={'OuterDiameter':('length',d),'Count':('count',1)}
            elif isinstance(e,SanitaryTerminal):
                ax=_axis(s,e.position.x-e.width/2,e.position.y-e.depth/2,e.position.z,math.radians(e.rotation_deg));lp=s.add(f"IFCLOCALPLACEMENT($,#{ax})");shape=_box_shape(s,ctx,e.width,e.depth,e.height);pre={'sink':'SINK','lavatory':'SINK','toilet':'TOILETPAN','urinal':'URINAL','shower':'SHOWER','tank':'CISTERN'}.get(e.terminal_type,'NOTDEFINED');ent=s.add(f"IFCSANITARYTERMINAL('{_guid(e.id)}',#{owner},{_s(e.name or e.id)},$,$,#{lp},#{shape},$,.{pre}.)");quant={'Width':('length',e.width),'Depth':('length',e.depth),'Height':('length',e.height)}
            elif isinstance(e,Furniture):
                ax=_axis(s,e.position.x-e.width/2,e.position.y-e.depth/2,e.position.z,math.radians(e.rotation_deg));lp=s.add(f"IFCLOCALPLACEMENT($,#{ax})");shape=_box_shape(s,ctx,e.width,e.depth,e.height);ent=s.add(f"IFCFURNITURE('{_guid(e.id)}',#{owner},{_s(e.name or e.furniture_type)},$,$,#{lp},#{shape},$,.USERDEFINED.)");quant={'Width':('length',e.width),'Depth':('length',e.depth),'Height':('length',e.height)}
            elif isinstance(e,Equipment):
                ax=_axis(s,e.position.x,e.position.y,e.position.z,math.radians(e.rotation_deg)); lp=s.add(f"IFCLOCALPLACEMENT($,#{ax})"); shape=_box_shape(s,ctx,.20,.20,.20)
                if _equipment_class(e)=='valve':ent=s.add(f"IFCVALVE('{_guid(e.id)}',#{owner},{_s(e.name or e.equipment_type)},$,$,#{lp},#{shape},$,.NOTDEFINED.)")
                else:ent=s.add(f"IFCBUILDINGELEMENTPROXY('{_guid(e.id)}',#{owner},{_s(e.name or e.equipment_type)},$,$,#{lp},#{shape},$,.USERDEFINED.)")
            if ent:
                _attach_pset(s,owner,ent,seed,_common_props(e));_attach_qto(s,owner,ent,seed,quant)
                st=storeys.get(e.storey_id,first); contained.setdefault(st,[]).append(ent)
                sid=getattr(e,'system_id',None)
                if sid in ifc_systems:system_members[sid].append(ent)
        for sid,members in system_members.items():
            if members:s.add(f"IFCRELASSIGNSTOGROUP('{_guid(sid+':members')}',#{owner},$,$,("+','.join(f'#{x}' for x in members)+f"),$,#{ifc_systems[sid]})")
        for st,products in contained.items():
            if products:s.add(f"IFCRELCONTAINEDINSPATIALSTRUCTURE('{_guid(str(st)+'contains')}',#{owner},$,$,("+','.join('#'+str(x) for x in products)+f"),#{st})")
        payload=base64.b64encode(project.model_dump_json(exclude_computed_fields=True).encode()).decode();header="\n".join(["ISO-10303-21;","HEADER;","FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');",f"FILE_NAME('{target.name}','{datetime.now(timezone.utc).isoformat()}',('CompatibilizaBIM'),('CompatibilizaBIM'),'CBIM IFC Bridge','CompatibilizaBIM','');","FILE_SCHEMA(('IFC4'));","ENDSEC;","DATA;"]);body='\n'.join(f"#{i+1}={row};" for i,row in enumerate(s.rows));target.write_text(f"{header}\n/*CBIM_PAYLOAD_BASE64:{payload}*/\n{body}\nENDSEC;\nEND-ISO-10303-21;\n",encoding='utf-8');return target
    def import_file(self,path:str|Path)->CBIMProject:
        text=Path(path).read_text(encoding='utf-8',errors='replace');m=_PAYLOAD_RE.search(text)
        if not m:raise ValueError('IFC does not contain a CBIM round-trip payload; generic IFC import requires an IfcOpenShell backend')
        return CBIMProject.model_validate_json(base64.b64decode(m.group(1)).decode())
    @staticmethod
    def validate_with_ifcopenshell(path:str|Path,*,express_rules:bool=False):
        from .ifcopenshell_backend import IfcOpenShellBridge
        return IfcOpenShellBridge.validate(path,express_rules=express_rules)
    @staticmethod
    def sanity_check(path:str|Path)->dict[str,int|bool]:
        text=Path(path).read_text(encoding='utf-8',errors='replace');return {'has_step_header':text.startswith('ISO-10303-21;'),'has_ifc4_schema':"FILE_SCHEMA(('IFC4'))" in text,'has_end_marker':text.rstrip().endswith('END-ISO-10303-21;'),'entity_count':len(re.findall(r'^#\d+=IFC',text,re.MULTILINE))}
