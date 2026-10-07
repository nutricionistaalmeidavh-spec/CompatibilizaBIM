from compatibilizabim_core.validation.models import DisciplineValidationReport


def test_validation_report_exposes_architecture_and_network_reconstruction_diagnostics():
    fields=DisciplineValidationReport.model_fields
    for name in (
        'architecture_stair_count','architecture_slab_count','architecture_wall_count',
        'network_segmented_path_count','network_elbow_count','network_tee_count',
        'network_cross_count','network_reducer_count','network_coupling_candidate_count',
    ):
        assert name in fields
        assert fields[name].default == 0
