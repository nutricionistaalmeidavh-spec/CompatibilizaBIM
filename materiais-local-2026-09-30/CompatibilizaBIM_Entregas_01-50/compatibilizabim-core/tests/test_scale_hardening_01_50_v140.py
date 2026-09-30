from time import perf_counter
from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe,Point3D,System
from compatibilizabim_core.architecture.recognizer import ArchitectureRecognizer
from compatibilizabim_core.structure.recognizer import StructuralRecognizer
from compatibilizabim_core.connectivity import MEPConnectivityEngine
from compatibilizabim_core.cad.model import CadDocument,CadLine,CadPoint
from compatibilizabim_core.topology.model import TopologyGraph


def _line(i,y,layer):
    return CadLine(id=f'l{i}',layer=layer,start=CadPoint(x=0,y=y,z=0),end=CadPoint(x=10,y=y,z=0))

def test_architecture_spatial_candidates_scale_without_pairwise_explosion():
    # 20k parallel wall-tagged lines spaced far enough that only local neighbours are candidates.
    doc=CadDocument(source_id='stress',entities=[_line(i,i*.5,'WALL') for i in range(20_000)])
    seen={}
    def progress(stage,status,elapsed,detail): seen[stage]=detail
    t=perf_counter();ArchitectureRecognizer().recognize(doc,TopologyGraph(),progress=progress);elapsed=perf_counter()-t
    assert seen['architecture_wall_candidates']['candidate_pairs'] < 100_000
    assert elapsed < 8.0

def test_structure_spatial_candidates_scale_without_pairwise_explosion():
    doc=CadDocument(source_id='stress',entities=[_line(i,i*2.0,'VIGA') for i in range(20_000)])
    seen={}
    def progress(stage,status,elapsed,detail): seen[stage]=detail
    t=perf_counter();StructuralRecognizer().enrich(CBIMProject(name='x'),doc,progress=progress);elapsed=perf_counter()-t
    assert seen['structure_beam_candidates']['candidate_pairs'] < 100_000
    assert elapsed < 8.0

def test_connectivity_uses_spatial_hash_for_large_linear_network():
    s=System(name='AF',discipline='plumbing')
    pipes=[Pipe(path=[Point3D(x=i,y=0,z=0),Point3D(x=i+1,y=0,z=0)],diameter=.025,system_id=s.id) for i in range(5000)]
    p=CBIMProject(name='network',systems=[s],elements=pipes)
    t=perf_counter();nets=MEPConnectivityEngine().build(p);elapsed=perf_counter()-t
    assert len(nets)==1 and len(nets[0].edges)==5000
    assert elapsed < 8.0
