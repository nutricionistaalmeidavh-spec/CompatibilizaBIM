from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe,Point3D,System,Wall
from compatibilizabim_core.integration import CoreIntegrationGateway

def test_core_gateway_produces_viewer_clash_issue_5d_4d_snapshot():
    s=System(name='AF',discipline='plumbing',classification='cold_water')
    wall=Wall(start=Point3D(x=0,y=0),end=Point3D(x=3,y=0),thickness=.14,height=2.8,confidence=.98,review_state='confirmed')
    pipe=Pipe(path=[Point3D(x=0,y=1),Point3D(x=2,y=1)],diameter=.025,system_id=s.id,confidence=.7)
    snap=CoreIntegrationGateway().snapshot(CBIMProject(name='x',systems=[s],elements=[wall,pipe]))
    assert len(snap.viewer)==2 and {wall.id,pipe.id}<=set(snap.clash_candidates) and pipe.id in snap.issue_targets
    assert snap.quantities.totals_by_type['pipe']['length_m']==2 and 'unassigned' in snap.work_packages and snap.network_count==1
