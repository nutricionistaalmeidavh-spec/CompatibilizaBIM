from __future__ import annotations
import math
from pydantic import BaseModel,ConfigDict,Field
from cbim_sdk import CBIMProject
from cbim_sdk.models import Point3D
from ..cad.model import CadDocument,CadPoint,CadLine,CadPolyline,CadArc,CadCircle,CadSpline,CadInsert,CadText,CadBlock

class GeoModel(BaseModel):model_config=ConfigDict(extra='forbid')
class ProjectedReference(GeoModel):
    crs:str; origin_easting:float;origin_northing:float;origin_elevation:float=0.;rotation_deg:float=0.;latitude:float|None=Field(default=None,ge=-90,le=90);longitude:float|None=Field(default=None,ge=-180,le=180)
class LocalCoordinateFrame:
    """Precision-preserving projected/global <-> local coordinate frame."""
    def __init__(self,reference:ProjectedReference):self.ref=reference
    def to_local_xyz(self,x,y,z=0.):
        dx=x-self.ref.origin_easting;dy=y-self.ref.origin_northing;a=math.radians(-self.ref.rotation_deg);c,s=math.cos(a),math.sin(a)
        return dx*c-dy*s,dx*s+dy*c,z-self.ref.origin_elevation
    def to_global_xyz(self,x,y,z=0.):
        a=math.radians(self.ref.rotation_deg);c,s=math.cos(a),math.sin(a)
        return x*c-y*s+self.ref.origin_easting,x*s+y*c+self.ref.origin_northing,z+self.ref.origin_elevation
    def cad_point_to_local(self,p:CadPoint)->CadPoint:
        x,y,z=self.to_local_xyz(p.x,p.y,p.z);return CadPoint(x=x,y=y,z=z)
    def cad_point_to_global(self,p:CadPoint)->CadPoint:
        x,y,z=self.to_global_xyz(p.x,p.y,p.z);return CadPoint(x=x,y=y,z=z)
    def cbim_point_to_local(self,p:Point3D)->Point3D:
        x,y,z=self.to_local_xyz(p.x,p.y,p.z);return Point3D(x=x,y=y,z=z)
    def cbim_point_to_global(self,p:Point3D)->Point3D:
        x,y,z=self.to_global_xyz(p.x,p.y,p.z);return Point3D(x=x,y=y,z=z)

class GeoreferencingManager:
    def _cad_entity(self,e,frame:LocalCoordinateFrame,to_local:bool):
        x=e.model_copy(deep=True);pt=frame.cad_point_to_local if to_local else frame.cad_point_to_global
        if isinstance(x,CadLine):x.start=pt(x.start);x.end=pt(x.end)
        elif isinstance(x,(CadPolyline,CadSpline)):x.points=[pt(p) for p in x.points]
        elif isinstance(x,(CadCircle,CadArc)):x.center=pt(x.center)
        elif isinstance(x,(CadInsert,CadText)):x.position=pt(x.position)
        return x
    def transform_cad(self,doc:CadDocument,reference:ProjectedReference,*,to_local:bool=True)->CadDocument:
        f=LocalCoordinateFrame(reference);d=doc.model_copy(deep=True);d.entities=[self._cad_entity(e,f,to_local) for e in d.entities]
        d.blocks={name:CadBlock(name=b.name,base_point=(f.cad_point_to_local(b.base_point) if to_local else f.cad_point_to_global(b.base_point)),entities=[self._cad_entity(e,f,to_local) for e in b.entities]) for name,b in d.blocks.items()}
        d.metadata={**d.metadata,'coordinate_reference':reference.crs,'coordinate_mode':'local' if to_local else 'global','survey_origin_easting':reference.origin_easting,'survey_origin_northing':reference.origin_northing,'survey_rotation_deg':reference.rotation_deg}
        return d
    def attach_cbim_reference(self,project:CBIMProject,reference:ProjectedReference)->CBIMProject:
        p=project.model_copy(deep=True);p.coordinate_reference=reference.crs;p.metadata={**p.metadata,'coordinate_mode':'local','survey_origin_easting':reference.origin_easting,'survey_origin_northing':reference.origin_northing,'survey_origin_elevation':reference.origin_elevation,'survey_rotation_deg':reference.rotation_deg}
        if p.sites:
            s=p.sites[0];s.latitude=reference.latitude;s.longitude=reference.longitude;s.elevation=reference.origin_elevation;s.properties={**s.properties,'projected_crs':reference.crs,'origin_easting':reference.origin_easting,'origin_northing':reference.origin_northing,'rotation_deg':reference.rotation_deg}
        return CBIMProject.model_validate(p.model_dump(exclude_computed_fields=True))
    def transform_cbim(self,project:CBIMProject,reference:ProjectedReference,*,to_local:bool=True)->CBIMProject:
        p=project.model_copy(deep=True);f=LocalCoordinateFrame(reference);pt=f.cbim_point_to_local if to_local else f.cbim_point_to_global
        for e in p.elements:
            if hasattr(e,'start'):e.start=pt(e.start)
            if hasattr(e,'end'):e.end=pt(e.end)
            if hasattr(e,'center'):e.center=pt(e.center)
            if hasattr(e,'position'):e.position=pt(e.position)
            if hasattr(e,'boundary'):e.boundary=[pt(q) for q in e.boundary]
            if hasattr(e,'path'):e.path=[pt(q) for q in e.path]
        p.coordinate_reference='local' if to_local else reference.crs
        p.metadata={**p.metadata,'coordinate_mode':'local' if to_local else 'global','survey_origin_easting':reference.origin_easting,'survey_origin_northing':reference.origin_northing,'survey_origin_elevation':reference.origin_elevation,'survey_rotation_deg':reference.rotation_deg,'projected_crs':reference.crs}
        return CBIMProject.model_validate(p.model_dump(exclude_computed_fields=True))
