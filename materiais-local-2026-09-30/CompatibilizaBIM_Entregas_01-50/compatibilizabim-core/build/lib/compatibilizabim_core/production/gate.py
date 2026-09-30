from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class GateModel(BaseModel):model_config=ConfigDict(extra="forbid")


class ProductionEvidence(GateModel):
    core_tests_passed:bool
    cbim_tests_passed:bool
    core_coverage:float=Field(ge=0,le=1)
    cbim_coverage:float=Field(ge=0,le=1)
    benchmark_entity_count:int=Field(ge=0)
    benchmark_throughput_eps:float=Field(ge=0)
    benchmark_peak_memory_mb:float=Field(ge=0)
    benchmark_incremental_plan_ms:float=Field(default=0,ge=0)
    incremental_selection_ratio:float=Field(ge=0,le=1)
    coordinate_roundtrip_error_m:float=Field(ge=0)
    ifc_roundtrip_passed:bool
    zip_integrity_passed:bool
    native_dwg_backend_validated:bool=False
    real_complex_project_validated:bool=False
    real_project_element_count:int=0


class GateCriterion(GateModel):
    name:str
    passed:bool
    required_for:str
    observed:str
    requirement:str


class ProductionGateResult(GateModel):
    technical_gate_passed:bool
    production_ready:bool
    release_status:str
    criteria:list[GateCriterion]
    blockers:list[str]=Field(default_factory=list)


class ProductionScalabilityGate:
    """Two-tier release gate.

    Technical readiness can be proven with reproducible automated evidence. Production
    readiness additionally requires a real complex building and a validated native DWG
    provider; synthetic fixtures are never allowed to satisfy those external gates.
    """
    def __init__(self,*,min_core_coverage:float=.85,min_cbim_coverage:float=.90,min_benchmark_entities:int=50000,min_throughput_eps:float=1000,max_incremental_ratio:float=.10,max_incremental_plan_ms:float=10000,max_coordinate_error_m:float=1e-6,max_peak_memory_mb:float=2048):
        self.min_core_coverage=min_core_coverage;self.min_cbim_coverage=min_cbim_coverage;self.min_benchmark_entities=min_benchmark_entities;self.min_throughput_eps=min_throughput_eps;self.max_incremental_ratio=max_incremental_ratio;self.max_incremental_plan_ms=max_incremental_plan_ms;self.max_coordinate_error_m=max_coordinate_error_m;self.max_peak_memory_mb=max_peak_memory_mb
    def evaluate(self,e:ProductionEvidence)->ProductionGateResult:
        checks=[
            GateCriterion(name="core_tests",passed=e.core_tests_passed,required_for="technical",observed=str(e.core_tests_passed),requirement="all Core tests pass"),
            GateCriterion(name="cbim_tests",passed=e.cbim_tests_passed,required_for="technical",observed=str(e.cbim_tests_passed),requirement="all CBIM SDK tests pass"),
            GateCriterion(name="core_coverage",passed=e.core_coverage>=self.min_core_coverage,required_for="technical",observed=f"{e.core_coverage:.1%}",requirement=f">={self.min_core_coverage:.0%}"),
            GateCriterion(name="cbim_coverage",passed=e.cbim_coverage>=self.min_cbim_coverage,required_for="technical",observed=f"{e.cbim_coverage:.1%}",requirement=f">={self.min_cbim_coverage:.0%}"),
            GateCriterion(name="xxl_size",passed=e.benchmark_entity_count>=self.min_benchmark_entities,required_for="technical",observed=str(e.benchmark_entity_count),requirement=f">={self.min_benchmark_entities} CAD entities"),
            GateCriterion(name="xxl_throughput",passed=e.benchmark_throughput_eps>=self.min_throughput_eps,required_for="technical",observed=f"{e.benchmark_throughput_eps:.0f} entities/s",requirement=f">={self.min_throughput_eps:.0f} entities/s"),
            GateCriterion(name="xxl_memory",passed=e.benchmark_peak_memory_mb<=self.max_peak_memory_mb,required_for="technical",observed=f"{e.benchmark_peak_memory_mb:.1f} MB",requirement=f"<={self.max_peak_memory_mb:.0f} MB Python traced peak"),
            GateCriterion(name="incremental_locality",passed=e.incremental_selection_ratio<=self.max_incremental_ratio,required_for="technical",observed=f"{e.incremental_selection_ratio:.3%}",requirement=f"<={self.max_incremental_ratio:.0%} selected for a local edit"),
            GateCriterion(name="incremental_latency",passed=e.benchmark_incremental_plan_ms<=self.max_incremental_plan_ms,required_for="technical",observed=f"{e.benchmark_incremental_plan_ms:.1f} ms",requirement=f"<={self.max_incremental_plan_ms:.0f} ms on XXL synthetic case"),
            GateCriterion(name="coordinate_roundtrip",passed=e.coordinate_roundtrip_error_m<=self.max_coordinate_error_m,required_for="technical",observed=f"{e.coordinate_roundtrip_error_m:.3g} m",requirement=f"<={self.max_coordinate_error_m:g} m"),
            GateCriterion(name="ifc_roundtrip",passed=e.ifc_roundtrip_passed,required_for="technical",observed=str(e.ifc_roundtrip_passed),requirement="CBIM -> IFC -> CBIM smoke passes"),
            GateCriterion(name="zip_integrity",passed=e.zip_integrity_passed,required_for="technical",observed=str(e.zip_integrity_passed),requirement="archive integrity passes"),
            GateCriterion(name="native_dwg_backend",passed=e.native_dwg_backend_validated,required_for="production",observed=str(e.native_dwg_backend_validated),requirement="native DWG provider (ACadSharp primary; commercial fallback optional) compiled and tested with real DWG"),
            GateCriterion(name="real_complex_building",passed=e.real_complex_project_validated and e.real_project_element_count>0,required_for="production",observed=f"validated={e.real_complex_project_validated}, elements={e.real_project_element_count}",requirement="at least one real large/high-end project validated end-to-end"),
        ]
        technical=all(c.passed for c in checks if c.required_for=="technical")
        production=technical and all(c.passed for c in checks if c.required_for=="production")
        blockers=[c.name for c in checks if not c.passed]
        status="production_ready" if production else ("technical_candidate_external_validation_required" if technical else "technical_gate_failed")
        return ProductionGateResult(technical_gate_passed=technical,production_ready=production,release_status=status,criteria=checks,blockers=blockers)
