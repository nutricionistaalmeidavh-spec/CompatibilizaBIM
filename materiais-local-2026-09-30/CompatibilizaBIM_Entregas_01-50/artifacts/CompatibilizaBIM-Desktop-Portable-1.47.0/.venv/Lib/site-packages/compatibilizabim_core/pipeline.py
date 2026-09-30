from __future__ import annotations
from time import perf_counter
from typing import Callable
from .geometry.engine import GeometryEngine
from .topology.engine import TopologyEngine
from .architecture.recognizer import ArchitectureRecognizer
from .levels.reconstruct import LevelDefinition, Levels3DReconstructor
from .structure.recognizer import StructuralRecognizer
from .profiles import CadProfile, CadProfileEngine, observed_brazil_mep_profile
from .mep import FireRecognizer, HydraulicRecognizer, MEPNetworkReconstructor, MEPZReconstructor, ZReconstructionConfig
from .catalog import BrazilianCatalog,CatalogAdvisor,CatalogEnricher,load_brazil_seed
from .connectivity import MEPConnectivityEngine
from .intelligence import RecognitionIntelligence
from .advanced_geometry import AdvancedGeometryEngine
from .vertical import VerticalBuildingIntelligence
from .runtime_metrics import rss_mb

ProgressCallback = Callable[[str,str,float|None,dict],None]

class CADToCBIMPipeline:
    """Cumulative CAD -> CBIM pipeline.

    CBIM remains the stable product boundary. Built-in CAD conventions are conservative
    and exact; caller profiles can override them. Optional progress callbacks expose
    stage timings for real-project diagnostics.
    """
    def __init__(self,*,catalog:BrazilianCatalog|None=None):
        self.advanced_geometry=AdvancedGeometryEngine(); self.geometry=GeometryEngine(); self.topology=TopologyEngine(); self.architecture=ArchitectureRecognizer(); self.levels=Levels3DReconstructor(); self.structure=StructuralRecognizer(); self.profiles=CadProfileEngine(); self.hydraulic=HydraulicRecognizer(); self.fire=FireRecognizer(); self.z_reconstruction=MEPZReconstructor(); self.network_reconstruction=MEPNetworkReconstructor(); self.connectivity=MEPConnectivityEngine();self.catalog=catalog or load_brazil_seed();self.intelligence=RecognitionIntelligence();self.vertical=VerticalBuildingIntelligence()
    @staticmethod
    def _propagate_source_metadata(project,cad):
        lookup={e.id:e for e in cad.entities}
        p=project.model_copy(deep=True)
        for e in p.elements:
            for ref in e.source_refs:
                source=lookup.get(ref.entity_id)
                if source:
                    for k in ('profile_rule','semantic_target','semantic_system'):
                        if k in source.metadata:ref.metadata[k]=source.metadata[k]
        return p
    @staticmethod
    def _emit(progress:ProgressCallback|None,stage:str,status:str,elapsed:float|None=None,**detail):
        mem=rss_mb()
        if mem is not None: detail.setdefault('rss_mb',mem)
        if progress: progress(stage,status,elapsed,detail)
    def run(self,document,*,levels=None,project_name='Imported CAD',profile:CadProfile|None=None,include_hydraulic:bool=True,include_fire:bool=True,include_catalog:bool=True,preferred_manufacturer:str|None=None,include_intelligence:bool=True,use_builtin_mep_profile:bool=True,project_datum_elevation_m:float|None=None,progress:ProgressCallback|None=None):
        levels=levels or [LevelDefinition('Térreo',0,2.8)]
        source=document
        if use_builtin_mep_profile:
            source=self.profiles.apply(source,observed_brazil_mep_profile())
        if profile:
            source=self.profiles.apply(source,profile)
        t=perf_counter();self._emit(progress,'geometry','start',None,input_entities=len(source.entities));cad=self.geometry.process(source,expand_inserts=False);self._emit(progress,'geometry','done',perf_counter()-t,output_entities=len(cad.entities))
        t=perf_counter();self._emit(progress,'topology','start');topo=self.topology.build(cad,progress=progress);self._emit(progress,'topology','done',perf_counter()-t,nodes=len(topo.nodes),edges=len(topo.edges))
        t=perf_counter();self._emit(progress,'architecture','start');project=self.architecture.recognize(cad,topo,project_name=project_name,progress=progress);self._emit(progress,'architecture','done',perf_counter()-t,elements=len(project.elements))
        t=perf_counter();project=self.levels.apply(project,levels);project=self.structure.enrich(project,cad,progress=progress);project=self.levels.apply(project,levels);self._emit(progress,'levels_structure','done',perf_counter()-t,elements=len(project.elements))
        if include_hydraulic:
            t=perf_counter();self._emit(progress,'hydraulic_recognition','start');project=self.hydraulic.recognize(cad,project);self._emit(progress,'hydraulic_recognition','done',perf_counter()-t,elements=len(project.elements))
        if include_fire:
            t=perf_counter();self._emit(progress,'fire_recognition','start');project=self.fire.recognize(cad,project);self._emit(progress,'fire_recognition','done',perf_counter()-t,elements=len(project.elements))
        t=perf_counter();project=self.levels.apply(project,levels)
        z_engine=self.z_reconstruction if project_datum_elevation_m is None else MEPZReconstructor(ZReconstructionConfig(project_datum_elevation_m=project_datum_elevation_m))
        project,z_report=z_engine.reconstruct(project)
        self._emit(progress,'mep_z_reconstruction','done',perf_counter()-t,direct=z_report.direct_resolved,propagated=z_report.propagated,vertical=z_report.vertical_resolved,unresolved=z_report.unresolved,conflicting=z_report.conflicting)
        t=perf_counter();project,net_report=self.network_reconstruction.reconstruct(project);self._emit(progress,'mep_network_reconstruction','done',perf_counter()-t,segmented_paths=net_report.segmented_paths,elbows=net_report.elbows,tees=net_report.tees,crosses=net_report.crosses,reducers=net_report.reducers,coupling_candidates=net_report.coupling_candidates)
        t=perf_counter();project=self._propagate_source_metadata(project,cad);project=self.connectivity.enrich_relations(project);self._emit(progress,'connectivity','done',perf_counter()-t,relations=len(project.relations))
        if include_catalog:
            t=perf_counter();project=CatalogAdvisor(self.catalog).advise(project);project=CatalogEnricher(self.catalog).enrich(project,preferred_manufacturer=preferred_manufacturer);self._emit(progress,'catalog','done',perf_counter()-t,preferred_manufacturer=preferred_manufacturer or '',advised=sum(1 for e in project.elements if int(e.properties.get('catalog_candidate_count',0) or 0)>0))
        if include_intelligence:
            t=perf_counter();project=self.intelligence.apply(project);self._emit(progress,'intelligence','done',perf_counter()-t,elements=len(project.elements))
        return cad,topo,project
