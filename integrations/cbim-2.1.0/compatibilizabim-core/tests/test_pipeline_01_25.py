from cbim_sdk import CBIMProject
from cbim_sdk.models import Point3D,SourceRef,Wall
from compatibilizabim_core.cad.model import CadDocument,CadLine,CadPoint
from compatibilizabim_core.diff import CBIMDiffEngine
from compatibilizabim_core.performance import IncrementalPlanner
from compatibilizabim_core.complex import ComplexBuildingAssembler,ComplexProjectSpec,BuildingSpec,StoreySpec
from compatibilizabim_core.xref import XrefComposer,XrefNode,CadTransform
from compatibilizabim_core.georef import ProjectedReference,GeoreferencingManager

def test_cumulative_21_25_large_building_boundaries_work_together():
    spec=ComplexProjectSpec(name='Complexo',buildings=[BuildingSpec(name='Torre A',code='A',storeys=[StoreySpec(name='01',elevation=0,height=3)])])
    p=ComplexBuildingAssembler().create(spec);s=p.storeys[0]
    p.elements=[Wall(id='w',storey_id=s.id,start=Point3D(x=0,y=0),end=Point3D(x=5,y=0),thickness=.14,height=3,source_refs=[SourceRef(source_id='r1',entity_id='H1',layer='WALL')])]
    q=p.model_copy(deep=True);q.elements[0].end=Point3D(x=5.5,y=0)
    assert CBIMDiffEngine().compare(p,q).counts['modified']==1
    base=CadDocument(source_id='m',entities=[CadLine(id='L',start=CadPoint(x=200000,y=7600000),end=CadPoint(x=200010,y=7600000))])
    child=CadDocument(source_id='c',entities=[CadLine(id='L',start=CadPoint(x=0,y=0),end=CadPoint(x=1,y=0))])
    composed=XrefComposer().compose(XrefNode('MASTER',base,children=[XrefNode('ARQ',child,CadTransform(tx=200020,ty=7600000))]))
    local=GeoreferencingManager().transform_cad(composed,ProjectedReference(crs='EPSG:31983',origin_easting=200000,origin_northing=7600000))
    assert max(e.end.x for e in local.entities if hasattr(e,'end'))<30
    modified=local.model_copy(deep=True);modified.entities[0].end.x+=.5
    plan=IncrementalPlanner(tile_size_m=10).compare(local,modified)
    assert len(plan.changed)==1 and plan.affected_tiles
