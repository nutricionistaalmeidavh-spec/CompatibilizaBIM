import pytest
from cbim_sdk.models import Wall,Pipe,Point3D
from compatibilizabim_core.ifc import IFCBridge,IfcOpenShellBridge,ifcopenshell_available

def test_ifcopenshell_class_contract_is_explicit():
    wall=Wall(start=Point3D(x=0,y=0),end=Point3D(x=1,y=0),thickness=.1,height=3)
    pipe=Pipe(path=[Point3D(x=0,y=0),Point3D(x=1,y=0)],diameter=.025)
    assert IfcOpenShellBridge.class_for(wall)=='IfcWall'
    assert IfcOpenShellBridge.class_for(pipe)=='IfcPipeSegment'

def test_legacy_bridge_remains_default_and_ifcopenshell_validation_is_optional(tmp_path):
    from cbim_sdk import CBIMProject
    path=IFCBridge().export(CBIMProject(name='fallback'),tmp_path/'x.ifc')
    result=IFCBridge.validate_with_ifcopenshell(path)
    if ifcopenshell_available():
        assert result['available'] is True
    else:
        assert result['available'] is False and result['valid'] is None

def test_explicit_ifcopenshell_backend_requires_dependency_when_missing(tmp_path):
    if ifcopenshell_available():pytest.skip('IfcOpenShell installed in this environment')
    from cbim_sdk import CBIMProject
    with pytest.raises(RuntimeError):IFCBridge(backend='ifcopenshell').export(CBIMProject(name='x'),tmp_path/'x.ifc')
