from cbim_sdk import CBIMProject
from cbim_sdk.models import Furniture, Point3D, SanitaryTerminal, Stair, System


def test_new_architectural_and_mep_objects_round_trip():
    system = System(id='sys', name='AF', discipline='plumbing', classification='cold_water')
    project = CBIMProject(name='P', systems=[system], elements=[
        Stair(id='st1', boundary=[Point3D(x=0,y=0),Point3D(x=2,y=0),Point3D(x=2,y=4),Point3D(x=0,y=4)], width=2.0, riser_count=12, tread_depth=.28, height=3.0),
        SanitaryTerminal(id='sink1', position=Point3D(x=1,y=1), terminal_type='sink', width=.60, depth=.50, height=.85, system_id='sys'),
        Furniture(id='ctr1', position=Point3D(x=2,y=2), furniture_type='counter', width=1.8, depth=.60, height=.90),
    ])
    loaded = CBIMProject.model_validate_json(project.model_dump_json(exclude_computed_fields=True))
    assert loaded.element_counts() == {'stair':1,'sanitary_terminal':1,'furniture':1}
    assert loaded.elements[1].system_id == 'sys'
