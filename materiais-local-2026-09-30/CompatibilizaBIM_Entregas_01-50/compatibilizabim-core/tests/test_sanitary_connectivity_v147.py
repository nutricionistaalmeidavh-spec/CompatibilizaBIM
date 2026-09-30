from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe,Point3D,SanitaryTerminal,System
from compatibilizabim_core.connectivity import MEPConnectivityEngine
from compatibilizabim_core.mep.z_reconstruction import MEPZReconstructor


def test_sanitary_terminal_participates_in_connectivity_and_z_propagation():
    system=System(name='AF',discipline='plumbing',classification='cold_water')
    pipe=Pipe(path=[Point3D(x=0,y=0,z=.85),Point3D(x=1,y=0,z=.85)],diameter=.025,system_id=system.id)
    sink=SanitaryTerminal(position=Point3D(x=1,y=0,z=0),terminal_type='sink',system_id=system.id)
    project=CBIMProject(name='x',systems=[system],elements=[pipe,sink])
    networks=MEPConnectivityEngine().build(project)
    assert networks and any(sink.id in n.element_ids for n in networks for n in n.nodes)
    rebuilt,_=MEPZReconstructor().reconstruct(project)
    updated=next(e for e in rebuilt.elements if e.id==sink.id)
    assert updated.position.z==.85
