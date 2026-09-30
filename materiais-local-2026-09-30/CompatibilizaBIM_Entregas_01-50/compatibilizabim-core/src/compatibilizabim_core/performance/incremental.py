from __future__ import annotations
import hashlib, json, math, time
from collections import defaultdict
from pydantic import BaseModel, ConfigDict, Field
from ..cad.model import CadDocument, CadEntity, CadLine, CadPolyline, CadCircle, CadArc, CadSpline, CadInsert, CadText

class PerfModel(BaseModel): model_config=ConfigDict(extra='forbid')
class IncrementalChangeSet(PerfModel):
    added:list[str]=Field(default_factory=list); removed:list[str]=Field(default_factory=list); changed:list[str]=Field(default_factory=list); unchanged:list[str]=Field(default_factory=list); affected_tiles:list[tuple[int,int]]=Field(default_factory=list); requires_global_rebuild:bool=False
class BenchmarkResult(PerfModel):
    entity_count:int; tile_count:int; elapsed_ms:float; entities_per_second:float

class EntityHasher:
    @staticmethod
    def hash(entity:CadEntity)->str:
        payload=entity.model_dump(mode='json')
        raw=json.dumps(payload,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()
        return hashlib.sha256(raw).hexdigest()
    def document(self,doc:CadDocument)->dict[str,str]: return {e.id:self.hash(e) for e in doc.entities}

def _bbox(e:CadEntity):
    if isinstance(e,CadLine): xs=[e.start.x,e.end.x];ys=[e.start.y,e.end.y]
    elif isinstance(e,(CadPolyline,CadSpline)): xs=[p.x for p in e.points];ys=[p.y for p in e.points]
    elif isinstance(e,(CadCircle,CadArc)): xs=[e.center.x-e.radius,e.center.x+e.radius];ys=[e.center.y-e.radius,e.center.y+e.radius]
    elif isinstance(e,(CadInsert,CadText)): xs=[e.position.x];ys=[e.position.y]
    else:return (0.,0.,0.,0.)
    return min(xs),min(ys),max(xs),max(ys)

class SpatialPartitioner:
    def __init__(self,*,tile_size_m:float=25.0):
        if tile_size_m<=0:raise ValueError('tile_size_m must be positive')
        self.tile_size=tile_size_m
    def keys_for_entity(self,e:CadEntity)->set[tuple[int,int]]:
        x0,y0,x1,y1=_bbox(e);s=self.tile_size
        return {(ix,iy) for ix in range(math.floor(x0/s),math.floor(x1/s)+1) for iy in range(math.floor(y0/s),math.floor(y1/s)+1)}
    def partition(self,doc:CadDocument)->dict[tuple[int,int],list[str]]:
        out=defaultdict(list)
        for e in doc.entities:
            for key in self.keys_for_entity(e):out[key].append(e.id)
        return {k:sorted(v) for k,v in sorted(out.items())}

class IncrementalPlanner:
    """Plan safe incremental reprocessing without pretending normalization is always local."""
    def __init__(self,*,tile_size_m:float=25.0,neighbor_tiles:int=1):
        self.hasher=EntityHasher();self.partitioner=SpatialPartitioner(tile_size_m=tile_size_m);self.neighbor_tiles=neighbor_tiles
    def compare(self,before:CadDocument,after:CadDocument)->IncrementalChangeSet:
        bh=self.hasher.document(before);ah=self.hasher.document(after)
        added=sorted(ah.keys()-bh.keys());removed=sorted(bh.keys()-ah.keys());changed=sorted(k for k in ah.keys()&bh.keys() if ah[k]!=bh[k]);unchanged=sorted(k for k in ah.keys()&bh.keys() if ah[k]==bh[k])
        bby={e.id:e for e in before.entities};aby={e.id:e for e in after.entities};tiles=set()
        for eid in added+changed:
            for t in self.partitioner.keys_for_entity(aby[eid]):tiles.add(t)
        for eid in removed+changed:
            for t in self.partitioner.keys_for_entity(bby[eid]):tiles.add(t)
        expanded=set()
        for x,y in tiles:
            for dx in range(-self.neighbor_tiles,self.neighbor_tiles+1):
                for dy in range(-self.neighbor_tiles,self.neighbor_tiles+1):expanded.add((x+dx,y+dy))
        # Block definition changes, insert changes, and removals can affect distant/global consumers.
        global_rebuild=bool(removed) or any(isinstance(aby.get(i),CadInsert) or isinstance(bby.get(i),CadInsert) for i in changed+added)
        return IncrementalChangeSet(added=added,removed=removed,changed=changed,unchanged=unchanged,affected_tiles=sorted(expanded),requires_global_rebuild=global_rebuild)

def benchmark_partitioning(doc:CadDocument,*,tile_size_m:float=25.0)->BenchmarkResult:
    t=time.perf_counter();parts=SpatialPartitioner(tile_size_m=tile_size_m).partition(doc);elapsed=max(time.perf_counter()-t,1e-12)
    return BenchmarkResult(entity_count=len(doc.entities),tile_count=len(parts),elapsed_ms=elapsed*1000,entities_per_second=len(doc.entities)/elapsed)
