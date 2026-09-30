from __future__ import annotations

import time
import tracemalloc
from pydantic import BaseModel, ConfigDict, Field

from ..cad.model import CadDocument, CadLine, CadPoint
from ..complex import BuildingSpec, ComplexBuildingAssembler, ComplexProjectSpec, StoreySpec
from ..performance import DocumentFingerprinter, IncrementalReprocessor, benchmark_partitioning


class BenchmarkModel(BaseModel):model_config=ConfigDict(extra="forbid")


class XXLBenchmarkConfig(BenchmarkModel):
    towers:int=Field(default=4,ge=1,le=20)
    storeys_per_tower:int=Field(default=40,ge=1,le=200)
    entities_per_storey:int=Field(default=300,ge=10,le=5000)
    tile_size_m:float=Field(default=25.0,gt=0)
    storey_height_m:float=Field(default=3.0,gt=0)


class XXLBenchmarkReport(BenchmarkModel):
    towers:int
    total_storeys:int
    cad_entity_count:int
    tile_count:int
    partition_ms:float
    partition_entities_per_second:float
    fingerprint_ms:float
    incremental_plan_ms:float
    incremental_mode:str
    incremental_selected_entities:int
    incremental_selection_ratio:float
    hierarchy_ms:float
    python_peak_tracemalloc_mb:float


def _make_document(cfg:XXLBenchmarkConfig)->CadDocument:
    entities=[];eid=0
    # Each storey occupies a deterministic 80x80 local tile. Towers are 250m apart.
    for tower in range(cfg.towers):
        tower_x=tower*250.0
        for storey in range(cfg.storeys_per_tower):
            floor_y=storey*100.0
            cols=max(1,int(cfg.entities_per_storey**0.5));spacing=70.0/max(cols,1)
            for j in range(cfg.entities_per_storey):
                row=j//cols;col=j%cols;x=tower_x+col*spacing;y=floor_y+row*spacing
                entities.append(CadLine(id=f"E{eid}",layer="WALL",start=CadPoint(x=x,y=y,z=0),end=CadPoint(x=x+min(spacing*.8,4.0),y=y,z=0),metadata={"tower":tower,"storey":storey}))
                eid+=1
    return CadDocument(source_id="XXL_SYNTHETIC",entities=entities,layers=["WALL"],metadata={"synthetic_benchmark":True})


def _hierarchy(cfg:XXLBenchmarkConfig):
    buildings=[]
    for tower in range(cfg.towers):
        storeys=[StoreySpec(name=f"T{tower+1:02d}-{i+1:03d}",elevation=i*cfg.storey_height_m,height=cfg.storey_height_m,template="TIPO") for i in range(cfg.storeys_per_tower)]
        buildings.append(BuildingSpec(name=f"Torre {tower+1}",code=f"T{tower+1:02d}",storeys=storeys))
    return ComplexProjectSpec(name="XXL Synthetic",buildings=buildings)


def run_xxl_benchmark(config:XXLBenchmarkConfig|None=None)->XXLBenchmarkReport:
    cfg=config or XXLBenchmarkConfig();tracemalloc.start();doc=_make_document(cfg)
    p=benchmark_partitioning(doc,tile_size_m=cfg.tile_size_m)
    t=time.perf_counter();DocumentFingerprinter().fingerprint(doc,settings={"benchmark":"xxl"});fingerprint_ms=(time.perf_counter()-t)*1000
    modified=doc.model_copy(deep=True);idx=max(0,len(modified.entities)//2);line=modified.entities[idx];line.end.x+=0.2
    t=time.perf_counter();plan=IncrementalReprocessor(tile_size_m=cfg.tile_size_m,neighbor_tiles=1).plan(doc,modified);incremental_ms=(time.perf_counter()-t)*1000
    t=time.perf_counter();ComplexBuildingAssembler().create(_hierarchy(cfg));hierarchy_ms=(time.perf_counter()-t)*1000
    _,peak=tracemalloc.get_traced_memory();tracemalloc.stop()
    return XXLBenchmarkReport(
        towers=cfg.towers,total_storeys=cfg.towers*cfg.storeys_per_tower,cad_entity_count=len(doc.entities),tile_count=p.tile_count,
        partition_ms=p.elapsed_ms,partition_entities_per_second=p.entities_per_second,fingerprint_ms=fingerprint_ms,incremental_plan_ms=incremental_ms,
        incremental_mode=plan.mode,incremental_selected_entities=len(plan.selected_entity_ids),incremental_selection_ratio=len(plan.selected_entity_ids)/max(1,len(doc.entities)),
        hierarchy_ms=hierarchy_ms,python_peak_tracemalloc_mb=peak/(1024*1024),
    )
