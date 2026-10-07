from cbim_sdk import CBIMProject
from cbim_sdk.models import Point3D, SourceRef, Wall
from compatibilizabim_core.diff import CBIMDiffEngine

def wall(eid='w1', *, y=0, thickness=.14, source_id='run-a'):
    return Wall(id=eid,start=Point3D(x=0,y=y),end=Point3D(x=5,y=y),thickness=thickness,height=2.8,source_refs=[SourceRef(source_id=source_id,entity_id='A12',layer='WALL')],properties={'finish':'paint'})

def test_diff_matches_revision_by_source_handle_and_classifies_changes():
    before=CBIMProject(name='R01',elements=[wall()])
    changed=wall('regenerated-id',y=.2,thickness=.19,source_id='run-b');changed.properties['finish']='stone'
    after=CBIMProject(name='R02',elements=[changed])
    d=CBIMDiffEngine().compare(before,after)
    assert d.counts=={'added':0,'removed':0,'modified':1}
    assert set(d.changes[0].categories)=={'geometry','properties'}

def test_diff_detects_added_and_removed():
    a=wall(); b=wall('w2');b.source_refs=[SourceRef(source_id='x',entity_id='B22',layer='WALL')]
    d=CBIMDiffEngine().compare(CBIMProject(name='a',elements=[a]),CBIMProject(name='b',elements=[b]))
    assert d.counts['added']==1 and d.counts['removed']==1
