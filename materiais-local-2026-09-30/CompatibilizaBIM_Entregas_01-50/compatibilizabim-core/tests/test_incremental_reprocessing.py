from cbim_sdk import CBIMProject
from cbim_sdk.models import Point3D,SourceRef,Wall
from compatibilizabim_core.cad.model import CadBlock,CadDocument,CadLine,CadPoint
from compatibilizabim_core.performance import IncrementalReprocessor


def doc(shift=0):
    return CadDocument(source_id='d',entities=[CadLine(id=f'L{i}',start=CadPoint(x=i*2,y=0),end=CadPoint(x=i*2+1+(shift if i==5 else 0),y=0)) for i in range(20)])


def test_local_reprocessing_slices_and_tracks_cbim_impact():
    a=doc();b=doc(.2);p=CBIMProject(name='p',elements=[Wall(id='w',start=Point3D(x=10,y=0),end=Point3D(x=11,y=0),thickness=.14,height=3,source_refs=[SourceRef(source_id='d',entity_id='L5')])])
    r=IncrementalReprocessor(tile_size_m=5,neighbor_tiles=1);plan=r.plan(a,b,project=p)
    assert plan.mode=='local' and 'w' in plan.impacted_cbim_ids and len(plan.selected_entity_ids)<20
    sliced=r.slice_document(b,plan);assert 0<len(sliced.entities)<20


def test_block_definition_change_forces_global_rebuild():
    a=doc();b=doc();a.blocks={'X':CadBlock(name='X',entities=[CadLine(id='x',start=CadPoint(x=0,y=0),end=CadPoint(x=1,y=0))])};b.blocks={'X':CadBlock(name='X',entities=[CadLine(id='x',start=CadPoint(x=0,y=0),end=CadPoint(x=2,y=0))])}
    plan=IncrementalReprocessor().plan(a,b)
    assert plan.mode=='global' and 'block_definition_changed' in plan.reasons


def test_execute_chooses_local_or_global_processor():
    a=doc();b=doc(.1);r=IncrementalReprocessor(tile_size_m=5)
    result=r.execute(a,b,local_processor=lambda d:('local',len(d.entities)),global_processor=lambda d:('global',len(d.entities)))
    assert result.output[0]=='local' and result.output[1]<20
