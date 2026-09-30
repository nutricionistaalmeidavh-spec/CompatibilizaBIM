from cbim_sdk import CBIMProject
from cbim_sdk.models import Furniture, Fitting, Pipe, Point3D, SanitaryTerminal, Stair, System
from compatibilizabim_core.ifc import IFCBridge


def test_legacy_ifc_uses_swept_disk_for_circular_pipe_and_quantities(tmp_path):
    s=System(id='sys',name='AF',discipline='plumbing',classification='cold_water')
    pr=CBIMProject(name='P',systems=[s],elements=[Pipe(id='p',path=[Point3D(x=0,y=0,z=.5),Point3D(x=2,y=0,z=.5)],diameter=.032,system_id='sys',properties={'service':'cold_water'})])
    path=IFCBridge('legacy').export(pr,tmp_path/'p.ifc');text=path.read_text()
    assert 'IFCSWEPTDISKSOLID(' in text
    assert 'IFCBLOCK(' not in '\n'.join(line for line in text.splitlines() if 'PIPESEGMENT' in line)
    assert "IFCELEMENTQUANTITY(" in text and "IFCQUANTITYLENGTH('Length'" in text
    assert "IFCPROPERTYSET(" in text and "'NominalDiameter'" in text


def test_legacy_ifc_exports_stair_sink_and_counter_as_semantic_classes(tmp_path):
    pr=CBIMProject(name='P',elements=[
        Stair(id='st',boundary=[Point3D(x=0,y=0),Point3D(x=1.2,y=0),Point3D(x=1.2,y=2.0),Point3D(x=0,y=2.0)],width=1.2,riser_count=8,tread_depth=.25,height=2.8),
        SanitaryTerminal(id='sink',position=Point3D(x=3,y=1),terminal_type='sink',width=.6,depth=.5,height=.85),
        Furniture(id='ctr',position=Point3D(x=4,y=1),furniture_type='counter',width=2,depth=.6,height=.9),
    ])
    text=IFCBridge('legacy').export(pr,tmp_path/'objects.ifc').read_text()
    assert 'IFCSTAIR(' in text
    assert 'IFCSANITARYTERMINAL(' in text and '.SINK.' in text
    assert 'IFCFURNITURE(' in text


def test_fitting_is_separate_ifc_object_with_topology_properties(tmp_path):
    fit=Fitting(id='f',position=Point3D(x=1,y=1,z=.5),fitting_type='tee',nominal_diameter=.05,properties={'inferred_from_topology':True})
    text=IFCBridge('legacy').export(CBIMProject(name='P',elements=[fit]),tmp_path/'f.ifc').read_text()
    assert 'IFCPIPEFITTING(' in text
    assert "'FittingType'" in text and "'tee'" in text


def test_legacy_ifc_fitting_geometry_is_circular_when_connected_pipes_are_known(tmp_path):
    s=System(id='sys',name='AF',discipline='plumbing',classification='cold_water')
    p1=Pipe(id='p1',path=[Point3D(x=0,y=0,z=.5),Point3D(x=1,y=0,z=.5)],diameter=.032,system_id='sys')
    p2=Pipe(id='p2',path=[Point3D(x=1,y=0,z=.5),Point3D(x=1,y=1,z=.5)],diameter=.032,system_id='sys')
    fit=Fitting(id='f',position=Point3D(x=1,y=0,z=.5),fitting_type='elbow',nominal_diameter=.032,system_id='sys',properties={'connected_pipe_ids':'p1,p2'})
    text=IFCBridge('legacy').export(CBIMProject(name='P',systems=[s],elements=[p1,p2,fit]),tmp_path/'fitting.ifc').read_text()
    # 2 pipes + at least 2 swept-disk fitting arms; the fitting must not be a rectangular block.
    assert text.count('IFCSWEPTDISKSOLID(') >= 4


def test_legacy_ifc_exports_distribution_system_assignment_for_mep(tmp_path):
    s=System(id='sys',name='Água fria',discipline='plumbing',classification='cold_water')
    p=Pipe(id='p',path=[Point3D(x=0,y=0),Point3D(x=1,y=0)],diameter=.025,system_id='sys')
    text=IFCBridge('legacy').export(CBIMProject(name='P',systems=[s],elements=[p]),tmp_path/'system.ifc').read_text()
    assert 'IFCDISTRIBUTIONSYSTEM(' in text
    assert 'IFCRELASSIGNSTOGROUP(' in text
    assert "'Água fria'" in text
