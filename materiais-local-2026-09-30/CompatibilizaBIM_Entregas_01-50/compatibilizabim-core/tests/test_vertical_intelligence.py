from cbim_sdk import CBIMProject
from cbim_sdk.models import Building,Column,Door,Point3D,Relation,Storey,Wall
from compatibilizabim_core.vertical import VerticalBuildingIntelligence


def project():
    b=Building(id='b',name='Tower');s1=Storey(id='s1',name='01',building_id='b',elevation=0,height=3);s2=Storey(id='s2',name='02',building_id='b',elevation=3,height=3)
    w=Wall(id='w',storey_id='s1',start=Point3D(x=0,y=0,z=0),end=Point3D(x=5,y=0,z=0),thickness=.14,height=3,review_state='confirmed')
    d=Door(id='d',storey_id='s1',position=Point3D(x=2,y=0,z=0),width=.8,height=2.1,host_id='w',review_state='confirmed')
    c1=Column(id='c1',storey_id='s1',center=Point3D(x=1,y=1,z=0),width=.3,depth=.3,height=3)
    c2=Column(id='c2',storey_id='s2',center=Point3D(x=1.01,y=.99,z=3),width=.3,depth=.3,height=3)
    return CBIMProject(name='p',buildings=[b],storeys=[s1,s2],elements=[w,d,c1,c2],relations=[Relation(id='hostrel',type='host',from_id='d',to_id='w')])


def test_vertical_stack_and_propagation_preserve_hosts_and_relations():
    p=project();v=VerticalBuildingIntelligence(alignment_tolerance_m=.05)
    stacks=v.vertical_stacks(p)
    assert any(s.stack_type=='column_stack' and set(s.element_ids)=={'c1','c2'} for s in stacks)
    proposal=v.propagation_plan(p,'s1',['s2'],only_confirmed=True)[0]
    out=v.apply_propagation(p,proposal)
    nw=next(e for e in out.elements if e.id=='w__s2');nd=next(e for e in out.elements if e.id=='d__s2')
    assert nw.start.z==3 and nd.position.z==3 and nd.host_id=='w__s2'
    assert any(r.from_id=='d__s2' and r.to_id=='w__s2' for r in out.relations)


def test_repeated_storey_fingerprint_is_geometry_aware():
    p=project();v=VerticalBuildingIntelligence();
    # Only columns exist on s2 initially, so floors are not falsely marked identical.
    assert v.repeated_storeys(p)==[]
