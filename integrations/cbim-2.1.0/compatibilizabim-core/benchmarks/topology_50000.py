from time import perf_counter
from compatibilizabim_core import CadDocument,CadLine,CadPoint,TopologyEngine

N=50_000
entities=[CadLine(id=f'L{i}',start=CadPoint(x=0,y=i*.05),end=CadPoint(x=1,y=i*.05)) for i in range(N)]
doc=CadDocument(source_id='topology-50000',entities=entities)
t0=perf_counter()
graph=TopologyEngine(gap_tolerance_m=.001).build(doc,repair_gaps=True)
elapsed=perf_counter()-t0
print(f'segments={N} nodes={len(graph.nodes)} edges={len(graph.edges)} candidate_pairs={graph.metadata["candidate_pairs"]} elapsed_s={elapsed:.3f}')
