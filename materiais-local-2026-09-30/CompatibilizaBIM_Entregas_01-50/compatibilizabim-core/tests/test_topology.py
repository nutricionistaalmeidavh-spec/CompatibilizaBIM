from compatibilizabim_core import CadDocument,CadLine,CadPoint,TopologyEngine

def L(i,a,b):return CadLine(id=i,start=CadPoint(x=a[0],y=a[1]),end=CadPoint(x=b[0],y=b[1]))
def test_t_and_cross_junctions_are_noded():
    g=TopologyEngine().build(CadDocument(source_id='x',entities=[L('h',(-2,0),(2,0)),L('v',(0,-2),(0,2)),L('t',(1,0),(1,1))]))
    assert any(n.kind=='cross' and abs(n.x)<1e-9 and abs(n.y)<1e-9 for n in g.nodes)
    assert any(n.kind=='t_junction' and abs(n.x-1)<1e-9 for n in g.nodes)
def test_gap_repair_closes_face():
    g=TopologyEngine(gap_tolerance_m=.02).build(CadDocument(source_id='x',entities=[L('a',(0,0),(2,0)),L('b',(2,0),(2,2)),L('c',(2,2),(0,2)),L('d',(0,2),(0,.01))]))
    assert g.metadata['gaps_repaired']==1
    assert len(g.faces)==1 and abs(g.faces[0].area-4)<1e-6

def test_collinear_overlap_is_split_at_overlap_boundaries():
    g=TopologyEngine().build(CadDocument(source_id='x',entities=[L('a',(0,0),(3,0)),L('b',(1,0),(2,0))]),repair_gaps=False)
    xs=sorted({round(n.x,6) for n in g.nodes})
    assert xs==[0.0,1.0,2.0,3.0]
    assert len(g.edges)==4


def test_profile_ignored_linework_is_excluded_from_topology():
    ignored=CadLine(id='note',layer='TEXTO',start=CadPoint(x=0,y=0),end=CadPoint(x=1,y=0),metadata={'semantic_target':'ignore'})
    kept=L('pipe',(0,1),(1,1))
    g=TopologyEngine().build(CadDocument(source_id='x',entities=[ignored,kept]),repair_gaps=False)
    assert len(g.edges)==1
    assert g.edges[0].source_entity_id=='pipe'
    assert g.metadata['ignored_entities']==1


def test_spatial_index_avoids_all_pairs_for_sparse_linework():
    entities=[L(f'l{i}',(0,i*.1),(1,i*.1)) for i in range(2500)]
    g=TopologyEngine(gap_tolerance_m=.001).build(CadDocument(source_id='x',entities=entities),repair_gaps=False)
    assert len(g.edges)==2500
    assert g.metadata['candidate_pairs']==0
    assert g.metadata['segment_count']==2500

def test_topology_emits_substage_progress():
    events=[]
    def progress(stage,status,elapsed,detail): events.append((stage,status,elapsed,detail))
    TopologyEngine().build(CadDocument(source_id='x',entities=[L('a',(0,0),(1,0)),L('b',(.5,-1),(.5,1))]),repair_gaps=False,progress=progress)
    done={stage for stage,status,_,_ in events if status=='done'}
    assert {'topology_spatial_index','topology_intersections','topology_edges','topology_gap_repair','topology_faces'} <= done
