from compatibilizabim_core.benchmark import XXLBenchmarkConfig,run_xxl_benchmark
from compatibilizabim_core.production import ProductionEvidence,ProductionScalabilityGate


def test_xxl_benchmark_exercises_multi_tower_local_incremental_path():
    r=run_xxl_benchmark(XXLBenchmarkConfig(towers=2,storeys_per_tower=4,entities_per_storey=100))
    assert r.total_storeys==8 and r.cad_entity_count==800 and r.incremental_mode=='local'
    assert r.incremental_selection_ratio<.5 and r.partition_entities_per_second>100


def test_production_gate_separates_technical_from_real_world_readiness():
    e=ProductionEvidence(core_tests_passed=True,cbim_tests_passed=True,core_coverage=.91,cbim_coverage=.95,benchmark_entity_count=50000,benchmark_throughput_eps=5000,benchmark_peak_memory_mb=500,incremental_selection_ratio=.02,coordinate_roundtrip_error_m=1e-9,ifc_roundtrip_passed=True,zip_integrity_passed=True,native_dwg_backend_validated=False,real_complex_project_validated=False)
    r=ProductionScalabilityGate().evaluate(e)
    assert r.technical_gate_passed and not r.production_ready
    assert set(r.blockers)=={'native_dwg_backend','real_complex_building'}
