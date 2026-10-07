from compatibilizabim_core.cad.model import CadDocument,CadLine,CadPoint,CadInsert
from compatibilizabim_core.performance import IncrementalPlanner,SpatialPartitioner,benchmark_partitioning

def doc(n=2000,shift=None):
    es=[]
    for i in range(n):
        y=i%100; x=(i//100)*2
        dx=.1 if shift==i else 0
        es.append(CadLine(id=f'L{i}',layer='WALL',start=CadPoint(x=x+dx,y=y),end=CadPoint(x=x+1+dx,y=y)))
    return CadDocument(source_id='p',entities=es)

def test_incremental_planner_limits_local_change_to_neighbor_tiles():
    a=doc(500);b=doc(500,shift=123)
    plan=IncrementalPlanner(tile_size_m=10).compare(a,b)
    assert plan.changed==['L123'] and len(plan.affected_tiles)<=9 and not plan.requires_global_rebuild

def test_removal_requires_safe_global_rebuild():
    a=doc(10);b=CadDocument(source_id='p2',entities=a.entities[:-1])
    assert IncrementalPlanner().compare(a,b).requires_global_rebuild

def test_partition_benchmark_handles_large_fixture():
    d=doc(10000); result=benchmark_partitioning(d,tile_size_m=20)
    assert result.entity_count==10000 and result.tile_count>10 and result.entities_per_second>1000
