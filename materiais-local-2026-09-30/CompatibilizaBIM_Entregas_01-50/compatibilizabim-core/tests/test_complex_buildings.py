from cbim_sdk.models import Point3D,Wall
from compatibilizabim_core.complex import ComplexBuildingAssembler,ComplexProjectSpec,BuildingSpec,StoreySpec,RepeatPatternDetector

def test_complex_project_supports_multiple_towers_and_repeated_floors():
    spec=ComplexProjectSpec(name='High End',buildings=[
      BuildingSpec(name='Torre A',code='A',storeys=[StoreySpec(name='Térreo',elevation=0,height=4),StoreySpec(name='A-01',elevation=4,height=3,template='TIPO-A'),StoreySpec(name='A-02',elevation=7,height=3,template='TIPO-A')]),
      BuildingSpec(name='Torre B',code='B',storeys=[StoreySpec(name='B-01',elevation=0,height=3,template='TIPO-B')])])
    p=ComplexBuildingAssembler().create(spec)
    assert len(p.buildings)==2 and len(p.storeys)==4
    a1,a2=[s for s in p.storeys if s.properties.get('template')=='TIPO-A']
    p.elements=[Wall(id='w1',storey_id=a1.id,start=Point3D(x=0,y=0),end=Point3D(x=5,y=0),thickness=.14,height=3),Wall(id='w2',storey_id=a2.id,start=Point3D(x=100,y=100),end=Point3D(x=105,y=100),thickness=.14,height=3)]
    patterns=RepeatPatternDetector().detect(p)
    assert len(patterns)==1 and set(patterns[0].storey_ids)=={a1.id,a2.id}

def test_assign_elements_validates_target_storey():
    p=ComplexBuildingAssembler().create(ComplexProjectSpec(name='x',buildings=[BuildingSpec(name='A',code='A',storeys=[StoreySpec(name='1',elevation=0,height=3)])]))
    p.elements=[Wall(id='w',start=Point3D(x=0,y=0),end=Point3D(x=1,y=0),thickness=.1,height=3)]
    out=ComplexBuildingAssembler().assign(p,{'w':p.storeys[0].id})
    assert out.elements[0].storey_id==p.storeys[0].id
