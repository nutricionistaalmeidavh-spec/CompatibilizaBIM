from cbim_sdk import CBIMProject
from cbim_sdk.models import Fitting,Pipe,Point3D,System
from compatibilizabim_core.connectivity import MEPConnectivityEngine

def test_connectivity_splits_main_at_tee_and_adds_relations():
    s=System(name='AF',discipline='plumbing',classification='cold_water')
    main=Pipe(path=[Point3D(x=0,y=0),Point3D(x=2,y=0)],diameter=.025,system_id=s.id)
    branch=Pipe(path=[Point3D(x=1,y=0),Point3D(x=1,y=1)],diameter=.025,system_id=s.id)
    tee=Fitting(position=Point3D(x=1,y=0),fitting_type='tee',nominal_diameter=.025,system_id=s.id)
    p=CBIMProject(name='x',systems=[s],elements=[main,branch,tee]); eng=MEPConnectivityEngine(tolerance_m=.01);nets=eng.build(p)
    assert len(nets)==1 and len(nets[0].components)==1 and len(nets[0].edges)==3
    junction=next(n for n in nets[0].nodes if tee.id in n.element_ids); assert {main.id,branch.id,tee.id} <= set(junction.element_ids)
    out=eng.enrich_relations(p); pairs={frozenset((r.from_id,r.to_id)) for r in out.relations if r.type=='connects'}; assert frozenset((main.id,tee.id)) in pairs and frozenset((branch.id,tee.id)) in pairs
