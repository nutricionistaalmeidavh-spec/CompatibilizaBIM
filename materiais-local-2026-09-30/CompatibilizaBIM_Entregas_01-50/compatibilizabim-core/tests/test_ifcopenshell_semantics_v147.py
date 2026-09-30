from cbim_sdk.models import Equipment,Furniture,Point3D,SanitaryTerminal,Stair
from compatibilizabim_core.ifc.ifcopenshell_backend import IfcOpenShellBridge


def test_ifcopenshell_class_mapping_for_new_objects_and_valves():
    stair=Stair(boundary=[Point3D(x=0,y=0),Point3D(x=1,y=0),Point3D(x=1,y=2)],width=1,riser_count=6,tread_depth=.28,height=2.8)
    sink=SanitaryTerminal(position=Point3D(x=0,y=0),terminal_type='sink')
    counter=Furniture(position=Point3D(x=0,y=0),furniture_type='counter')
    valve=Equipment(position=Point3D(x=0,y=0),equipment_type='REGISTRO_GAVETA')
    assert IfcOpenShellBridge.class_for(stair)=='IfcStair'
    assert IfcOpenShellBridge.class_for(sink)=='IfcSanitaryTerminal'
    assert IfcOpenShellBridge.class_for(counter)=='IfcFurniture'
    assert IfcOpenShellBridge.class_for(valve)=='IfcValve'
