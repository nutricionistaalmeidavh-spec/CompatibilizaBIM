import pytest
from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe,Point3D,Slab,System,Wall
from compatibilizabim_core.quantities import QuantityCalculator

def test_quantities_calculates_architecture_structure_and_mep():
    s=System(name='AF',discipline='plumbing',classification='cold_water')
    wall=Wall(start=Point3D(x=0,y=0),end=Point3D(x=5,y=0),thickness=.2,height=3)
    slab=Slab(boundary=[Point3D(x=0,y=0),Point3D(x=5,y=0),Point3D(x=5,y=4),Point3D(x=0,y=4)],thickness=.12)
    pipe=Pipe(path=[Point3D(x=0,y=0),Point3D(x=3,y=4)],diameter=.025,system_id=s.id)
    q=QuantityCalculator().calculate(CBIMProject(name='x',systems=[s],elements=[wall,slab,pipe]))
    assert q.totals_by_type['wall']['length_m']==5 and q.totals_by_type['wall']['area_m2']==15 and q.totals_by_type['wall']['volume_m3']==3
    assert q.totals_by_type['slab']['area_m2']==20 and q.totals_by_type['pipe']['length_m']==5


def test_quantities_include_stair_sanitary_and_furniture():
    from cbim_sdk.models import Furniture,SanitaryTerminal,Stair
    stair=Stair(boundary=[Point3D(x=0,y=0),Point3D(x=1,y=0),Point3D(x=1,y=3),Point3D(x=0,y=3)],width=1,riser_count=15,tread_depth=.28,height=2.8)
    sink=SanitaryTerminal(position=Point3D(x=2,y=0),terminal_type='sink',width=.6,depth=.5,height=.85)
    counter=Furniture(position=Point3D(x=3,y=0),furniture_type='counter',width=1.8,depth=.6,height=.9)
    q=QuantityCalculator().calculate(CBIMProject(name='x',elements=[stair,sink,counter]))
    assert q.totals_by_type['stair']['area_m2']==3
    assert q.totals_by_type['sanitary_terminal']['area_m2']==pytest.approx(.3)
    assert q.totals_by_type['furniture']['area_m2']==pytest.approx(1.08)
