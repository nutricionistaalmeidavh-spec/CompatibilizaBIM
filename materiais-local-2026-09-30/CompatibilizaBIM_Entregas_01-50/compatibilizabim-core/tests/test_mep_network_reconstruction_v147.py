from cbim_sdk import CBIMProject
from cbim_sdk.models import Fitting, Pipe, Point3D, System
from compatibilizabim_core.mep.network_reconstruction import MEPNetworkReconstructor


def p(x,y,z=0): return Point3D(x=x,y=y,z=z)
def project(elements):
    s=System(id='sys',name='AF',discipline='plumbing',classification='cold_water')
    return CBIMProject(name='P',systems=[s],elements=elements)
def pipe(id,pts,d=.025): return Pipe(id=id,path=pts,diameter=d,system_id='sys')


def test_polyline_bend_becomes_two_straight_pipes_and_elbow():
    out,report=MEPNetworkReconstructor().reconstruct(project([pipe('p1',[p(0,0),p(2,0),p(2,2)])]))
    pipes=[e for e in out.elements if isinstance(e,Pipe)]; fits=[e for e in out.elements if isinstance(e,Fitting)]
    assert len(pipes)==1 and len(pipes[0].path)==3
    assert len(fits)==1 and fits[0].fitting_type=='elbow'
    assert report.elbows==1 and report.segmented_paths==1


def test_three_way_junction_creates_tee():
    src=[pipe('a',[p(0,0),p(2,0)]),pipe('b',[p(2,0),p(4,0)]),pipe('c',[p(2,0),p(2,2)])]
    out,report=MEPNetworkReconstructor().reconstruct(project(src))
    fits=[e for e in out.elements if isinstance(e,Fitting)]
    assert any(f.fitting_type=='tee' for f in fits)
    assert report.tees==1


def test_diameter_change_at_collinear_node_creates_reducer():
    src=[pipe('a',[p(0,0),p(2,0)],.025),pipe('b',[p(2,0),p(4,0)],.032)]
    out,report=MEPNetworkReconstructor().reconstruct(project(src))
    fits=[e for e in out.elements if isinstance(e,Fitting)]
    assert len(fits)==1 and fits[0].fitting_type=='reducer'
    assert report.reducers==1


def test_collinear_same_diameter_fragments_do_not_invent_coupling():
    src=[pipe('a',[p(0,0),p(2,0)]),pipe('b',[p(2,0),p(4,0)])]
    out,report=MEPNetworkReconstructor().reconstruct(project(src))
    assert not [e for e in out.elements if isinstance(e,Fitting)]
    assert report.coupling_candidates==1
