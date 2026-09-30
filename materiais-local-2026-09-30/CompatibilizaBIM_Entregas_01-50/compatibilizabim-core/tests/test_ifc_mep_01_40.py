from cbim_sdk import CBIMProject
from cbim_sdk.models import Equipment,Fitting,Pipe,Point3D,System
from compatibilizabim_core.ifc import IFCBridge

def test_ifc_exports_visible_mep_entities(tmp_path):
    s=System(name='AF',discipline='plumbing')
    p=CBIMProject(name='MEP',systems=[s],elements=[
        Pipe(path=[Point3D(x=0,y=0,z=1),Point3D(x=2,y=0,z=1),Point3D(x=2,y=2,z=1)],diameter=.025,system_id=s.id),
        Fitting(position=Point3D(x=2,y=0,z=1),fitting_type='elbow',nominal_diameter=.025,system_id=s.id),
        Equipment(position=Point3D(x=0,y=0,z=1),equipment_type='registro',system_id=s.id),
    ])
    path=IFCBridge().export(p,tmp_path/'mep.ifc')
    text=path.read_text()
    assert text.count('IFCPIPESEGMENT(')==2
    assert 'IFCPIPEFITTING(' in text
    assert ('IFCVALVE(' in text) or ('IFCBUILDINGELEMENTPROXY(' in text)
    assert IFCBridge().import_file(path).element_counts()=={'pipe':1,'fitting':1,'equipment':1}
