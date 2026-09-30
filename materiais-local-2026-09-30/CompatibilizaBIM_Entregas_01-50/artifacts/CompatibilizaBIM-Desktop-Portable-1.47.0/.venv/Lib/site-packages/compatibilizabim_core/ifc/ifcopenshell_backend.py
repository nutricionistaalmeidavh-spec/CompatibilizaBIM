from __future__ import annotations
import math
from pathlib import Path
from typing import Any
from cbim_sdk import CBIMProject
from cbim_sdk.models import Beam,Column,Equipment,Fitting,Furniture,Pipe,SanitaryTerminal,Slab,Stair,Wall

CLASS_MAP={Wall:'IfcWall',Column:'IfcColumn',Beam:'IfcBeam',Slab:'IfcSlab',Stair:'IfcStair',Pipe:'IfcPipeSegment',Fitting:'IfcPipeFitting',SanitaryTerminal:'IfcSanitaryTerminal',Furniture:'IfcFurniture',Equipment:'IfcBuildingElementProxy'}

def available()->bool:
    try:
        import ifcopenshell  # noqa:F401
        return True
    except Exception:
        return False

def _clean_props(props:dict[str,Any])->dict[str,Any]:
    return {str(k):v for k,v in props.items() if isinstance(v,(str,int,float,bool)) or v is None}

def _box_vertices(cx,cy,cz,l,w,h,angle=0.0):
    ca,sa=math.cos(angle),math.sin(angle);verts=[]
    for x,y,z in [(-l/2,-w/2,0),(l/2,-w/2,0),(l/2,w/2,0),(-l/2,w/2,0),(-l/2,-w/2,h),(l/2,-w/2,h),(l/2,w/2,h),(-l/2,w/2,h)]:
        verts.append((cx+x*ca-y*sa,cy+x*sa+y*ca,cz+z))
    faces=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
    return verts,faces

def _prism_polygon(points,thickness):
    n=len(points);verts=[(p.x,p.y,p.z) for p in points]+[(p.x,p.y,p.z+thickness) for p in points]
    faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
    for i in range(n):faces.append((i,(i+1)%n,(i+1)%n+n,i+n))
    return verts,faces

def _pipe_mesh(a,b,diameter,sides=24):
    ax,ay,az=a.x,a.y,a.z;bx,by,bz=b.x,b.y,b.z;vx,vy,vz=bx-ax,by-ay,bz-az;L=math.sqrt(vx*vx+vy*vy+vz*vz)
    if L<=1e-9:return [],[]
    ux,uy,uz=vx/L,vy/L,vz/L
    ref=(0.,0.,1.) if abs(uz)<.9 else (1.,0.,0.)
    # perpendicular basis u x ref
    px,py,pz=uy*ref[2]-uz*ref[1],uz*ref[0]-ux*ref[2],ux*ref[1]-uy*ref[0];pl=math.sqrt(px*px+py*py+pz*pz);px,py,pz=px/pl,py/pl,pz/pl
    qx,qy,qz=uy*pz-uz*py,uz*px-ux*pz,ux*py-uy*px;r=diameter/2
    verts=[]
    for base in ((ax,ay,az),(bx,by,bz)):
        for i in range(sides):
            t=2*math.pi*i/sides;c,s=math.cos(t),math.sin(t);verts.append((base[0]+r*(c*px+s*qx),base[1]+r*(c*py+s*qy),base[2]+r*(c*pz+s*qz)))
    faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]
    for i in range(sides):faces.append((i,(i+1)%sides,(i+1)%sides+sides,i+sides))
    return verts,faces


def _pipe_directions_at(pipe:Pipe,position,tol=.05):
    dirs=[]
    for a,b in zip(pipe.path,pipe.path[1:]):
        for node,other in ((a,b),(b,a)):
            if math.dist((node.x,node.y,node.z),(position.x,position.y,position.z))>tol:continue
            vx,vy,vz=other.x-node.x,other.y-node.y,other.z-node.z;L=math.sqrt(vx*vx+vy*vy+vz*vz)
            if L<=1e-9:continue
            u=(vx/L,vy/L,vz/L)
            if not any(sum(x*y for x,y in zip(u,v))>.999 for v in dirs):dirs.append(u)
    return dirs

def _fitting_meshes(fitting:Fitting,pipes_by_id:dict[str,Pipe]):
    d=fitting.nominal_diameter or .05;ids=[x.strip() for x in str(fitting.properties.get('connected_pipe_ids','')).split(',') if x.strip()]
    dirs=[]
    for pid in ids:
        pipe=pipes_by_id.get(pid)
        if not pipe:continue
        for u in _pipe_directions_at(pipe,fitting.position,max(.05,d*2)):
            if not any(sum(x*y for x,y in zip(u,v))>.999 for v in dirs):dirs.append(u)
    if not dirs:dirs=[(1.,0.,0.),(-1.,0.,0.)]
    arm=max(.03,d*1.5);meshes=[]
    for ux,uy,uz in dirs:
        class P:pass
        a=P();a.x,a.y,a.z=fitting.position.x,fitting.position.y,fitting.position.z
        b=P();b.x,b.y,b.z=a.x+ux*arm,a.y+uy*arm,a.z+uz*arm
        v,f=_pipe_mesh(a,b,d)
        if v:meshes.append((v,f))
    return meshes

class IfcOpenShellBridge:
    """IfcOpenShell-backed CBIM authoring adapter.

    The adapter is optional at runtime. It maps CBIM semantics to IFC4 classes,
    spatial containment, distribution systems, custom CBIM properties and visible
    mesh geometry. The legacy STEP writer remains the compatibility fallback.
    """
    def __init__(self):
        if not available():raise RuntimeError('IfcOpenShell is not installed; install compatibilizabim-core[ifc] or pip install ifcopenshell')
    @staticmethod
    def class_for(element)->str:
        if isinstance(element,Equipment):
            label=f'{element.name or ""} {element.equipment_type}'.upper()
            if any(token in label for token in ('REGISTRO','VALVE','VALVULA','VÁLVULA')):
                return 'IfcValve'
        for cls,name in CLASS_MAP.items():
            if isinstance(element,cls):return name
        return 'IfcBuildingElementProxy'
    def export(self,project:CBIMProject,path:str|Path)->Path:
        import ifcopenshell.api.aggregate as aggregate
        import ifcopenshell.api.context as context
        import ifcopenshell.api.geometry as geometry
        import ifcopenshell.api.project as project_api
        import ifcopenshell.api.pset as pset
        import ifcopenshell.api.root as root
        import ifcopenshell.api.spatial as spatial
        import ifcopenshell.api.system as system_api
        import ifcopenshell.api.unit as unit
        model=project_api.create_file(version='IFC4')
        ifc_project=root.create_entity(model,ifc_class='IfcProject',name=project.name);unit.assign_unit(model)
        model_ctx=context.add_context(model,context_type='Model');body=context.add_context(model,context_type='Model',context_identifier='Body',target_view='MODEL_VIEW',parent=model_ctx)
        site_obj=project.sites[0] if project.sites else None;building_obj=project.buildings[0] if project.buildings else None
        site=root.create_entity(model,ifc_class='IfcSite',name=site_obj.name if site_obj else 'Site');aggregate.assign_object(model,products=[site],relating_object=ifc_project)
        building=root.create_entity(model,ifc_class='IfcBuilding',name=building_obj.name if building_obj else 'Building');aggregate.assign_object(model,products=[building],relating_object=site)
        storeys={}
        for s in project.storeys:
            st=root.create_entity(model,ifc_class='IfcBuildingStorey',name=s.name);st.Elevation=s.elevation;aggregate.assign_object(model,products=[st],relating_object=building);storeys[s.id]=st
        if not storeys:
            st=root.create_entity(model,ifc_class='IfcBuildingStorey',name='Storey');st.Elevation=0.;aggregate.assign_object(model,products=[st],relating_object=building);storeys[None]=st
        first=next(iter(storeys.values()))
        ifc_systems={}
        for s in project.systems:
            obj=system_api.add_system(model,ifc_class='IfcDistributionSystem');system_api.edit_system(model,system=obj,attributes={'Name':s.name,'Description':s.classification or s.discipline});ifc_systems[s.id]=obj
        by_system={}
        pipes_by_id={e.id:e for e in project.elements if isinstance(e,Pipe)}
        for e in project.elements:
            ifc_class=self.class_for(e);product=root.create_entity(model,ifc_class=ifc_class,name=e.name or e.id)
            if isinstance(e,Stair) and hasattr(product,'PredefinedType'):product.PredefinedType='STRAIGHT_RUN_STAIR'
            elif isinstance(e,SanitaryTerminal) and hasattr(product,'PredefinedType'):
                product.PredefinedType={'sink':'SINK','lavatory':'SINK','toilet':'TOILETPAN','urinal':'URINAL','shower':'SHOWER','tank':'CISTERN'}.get(e.terminal_type,'NOTDEFINED')
            elif isinstance(e,Furniture) and hasattr(product,'PredefinedType'):product.PredefinedType='USERDEFINED'
            spatial.assign_container(model,products=[product],relating_structure=storeys.get(e.storey_id,first))
            verts=faces=None
            if isinstance(e,Wall):
                dx,dy=e.end.x-e.start.x,e.end.y-e.start.y;L=math.hypot(dx,dy);verts,faces=_box_vertices((e.start.x+e.end.x)/2,(e.start.y+e.end.y)/2,e.start.z,L,e.thickness,e.height,math.atan2(dy,dx))
            elif isinstance(e,Column):verts,faces=_box_vertices(e.center.x,e.center.y,e.center.z,e.width,e.depth,e.height,math.radians(e.rotation_deg))
            elif isinstance(e,Beam):
                dx,dy=e.end.x-e.start.x,e.end.y-e.start.y;L=math.hypot(dx,dy);verts,faces=_box_vertices((e.start.x+e.end.x)/2,(e.start.y+e.end.y)/2,e.start.z,L,e.width,e.height,math.atan2(dy,dx))
            elif isinstance(e,Slab):verts,faces=_prism_polygon(e.boundary,e.thickness)
            elif isinstance(e,Stair):
                xs=[p.x for p in e.boundary];ys=[p.y for p in e.boundary];z=min(p.z for p in e.boundary);verts,faces=_box_vertices((min(xs)+max(xs))/2,(min(ys)+max(ys))/2,z,max(xs)-min(xs),max(ys)-min(ys),e.height,math.radians(e.direction_deg))
            elif isinstance(e,SanitaryTerminal):verts,faces=_box_vertices(e.position.x,e.position.y,e.position.z,e.width,e.depth,e.height,math.radians(e.rotation_deg))
            elif isinstance(e,Furniture):verts,faces=_box_vertices(e.position.x,e.position.y,e.position.z,e.width,e.depth,e.height,math.radians(e.rotation_deg))
            elif isinstance(e,Pipe):
                # Multi-segment CBIM pipes are represented as one IFC element with multiple meshes.
                meshes=[]
                for a,b in zip(e.path,e.path[1:]):
                    v,f=_pipe_mesh(a,b,e.diameter)
                    if v:meshes.append((v,f))
                if meshes:
                    reps=geometry.add_mesh_representation(model,context=body,vertices=[m[0] for m in meshes],faces=[m[1] for m in meshes]);geometry.assign_representation(model,product=product,representation=reps)
            elif isinstance(e,Fitting):
                meshes=_fitting_meshes(e,pipes_by_id)
                if meshes:
                    reps=geometry.add_mesh_representation(model,context=body,vertices=[m[0] for m in meshes],faces=[m[1] for m in meshes]);geometry.assign_representation(model,product=product,representation=reps)
            elif isinstance(e,Equipment):verts,faces=_box_vertices(e.position.x,e.position.y,e.position.z,.2,.2,.2,math.radians(e.rotation_deg))
            if verts and faces:
                rep=geometry.add_mesh_representation(model,context=body,vertices=[verts],faces=[faces]);geometry.assign_representation(model,product=product,representation=rep)
            geometry.edit_object_placement(model,product=product)
            props={'CBIMId':e.id,'CBIMType':e.type,'Confidence':float(e.confidence),**_clean_props(e.properties)}
            quantities={}
            if isinstance(e,Wall):
                props.update({'Length':float(e.length),'Thickness':float(e.thickness),'Height':float(e.height)});quantities={'Length':float(e.length),'Width':float(e.thickness),'Height':float(e.height),'NetSideArea':float(e.length*e.height),'NetVolume':float(e.length*e.thickness*e.height)}
            elif isinstance(e,Slab):
                area=abs(sum(e.boundary[i].x*e.boundary[(i+1)%len(e.boundary)].y-e.boundary[(i+1)%len(e.boundary)].x*e.boundary[i].y for i in range(len(e.boundary)))/2);props.update({'Thickness':float(e.thickness)});quantities={'NetArea':float(area),'Thickness':float(e.thickness),'NetVolume':float(area*e.thickness)}
            elif isinstance(e,Pipe):
                length=sum(math.dist((a.x,a.y,a.z),(b.x,b.y,b.z)) for a,b in zip(e.path,e.path[1:]));props.update({'NominalDiameter':float(e.diameter),'SystemId':e.system_id or ''});quantities={'Length':float(length),'OuterDiameter':float(e.diameter),'CrossSectionArea':float(math.pi*(e.diameter/2)**2),'NetVolume':float(math.pi*(e.diameter/2)**2*length)}
            elif isinstance(e,Fitting):props.update({'FittingType':e.fitting_type,'NominalDiameter':float(e.nominal_diameter or 0.)})
            elif isinstance(e,Stair):props.update({'RiserCount':e.riser_count,'TreadDepth':float(e.tread_depth),'Width':float(e.width),'Height':float(e.height)});quantities={'Width':float(e.width),'Height':float(e.height),'RiserCount':int(e.riser_count)}
            elif isinstance(e,SanitaryTerminal):props.update({'TerminalType':e.terminal_type,'Width':float(e.width),'Depth':float(e.depth),'Height':float(e.height)});quantities={'Width':float(e.width),'Depth':float(e.depth),'Height':float(e.height)}
            elif isinstance(e,Furniture):props.update({'FurnitureType':e.furniture_type,'Width':float(e.width),'Depth':float(e.depth),'Height':float(e.height)});quantities={'Width':float(e.width),'Depth':float(e.depth),'Height':float(e.height)}
            ps=pset.add_pset(model,product=product,name='CompatibilizaBIM');pset.edit_pset(model,pset=ps,properties=props)
            if quantities:
                qto=pset.add_qto(model,product=product,name='CBIM_BaseQuantities');pset.edit_qto(model,qto=qto,properties=quantities)
            sid=getattr(e,'system_id',None)
            if sid in ifc_systems:by_system.setdefault(sid,[]).append(product)
        for sid,products in by_system.items():system_api.assign_system(model,products=products,system=ifc_systems[sid])
        target=Path(path);model.write(str(target));return target
    @staticmethod
    def validate(path:str|Path,*,express_rules:bool=False)->dict[str,Any]:
        if not available():return {'available':False,'valid':None,'issues':['IfcOpenShell not installed']}
        import ifcopenshell
        import ifcopenshell.validate as validate
        model=ifcopenshell.open(str(path));logger=validate.json_logger();validate.validate(model,logger,express_rules=express_rules)
        issues=list(getattr(logger,'statements',[]) or [])
        return {'available':True,'valid':len(issues)==0,'issues':issues,'schema':model.schema,'entity_count':len(list(model))}
