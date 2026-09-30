from cbim_sdk import CBIMProject
from cbim_sdk.models import Building,Site,Storey,Point3D,Wall,Column,Slab
from compatibilizabim_core.ifc import IFCBridge
def test_ifc_export_is_step_ifc4_and_lossless_roundtrip(tmp_path):
    project=CBIMProject(name='IFC Demo',sites=[Site(name='Site')],buildings=[Building(name='Tower')],storeys=[Storey(name='Térreo',elevation=0,height=3)])
    st=project.storeys[0].id; project.elements += [Wall(name='W1',storey_id=st,start=Point3D(x=0,y=0),end=Point3D(x=5,y=0),thickness=.15,height=3),Column(name='C1',storey_id=st,center=Point3D(x=1,y=1),width=.3,depth=.4,height=3),Slab(name='S1',storey_id=st,boundary=[Point3D(x=0,y=0),Point3D(x=5,y=0),Point3D(x=5,y=4),Point3D(x=0,y=4)],thickness=.12)]
    path=IFCBridge().export(project,tmp_path/'demo.ifc'); text=path.read_text(); assert 'IFCWALL(' in text and 'IFCCOLUMN(' in text and 'IFCSLAB(' in text
    check=IFCBridge.sanity_check(path); assert check['has_step_header'] and check['has_ifc4_schema'] and check['has_end_marker'] and check['entity_count']>20
    loaded=IFCBridge().import_file(path); assert loaded.model_dump(exclude_computed_fields=True)==project.model_dump(exclude_computed_fields=True)
