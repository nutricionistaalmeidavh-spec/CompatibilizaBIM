from compatibilizabim_core.validation.models import DisciplineValidationReport


def test_validation_report_has_semantic_gate_diagnostics_with_safe_defaults():
    fields=DisciplineValidationReport.model_fields
    assert 'evidence_auto_create_count' in fields
    assert 'evidence_candidate_count' in fields
    assert 'evidence_rejected_count' in fields
    assert fields['evidence_auto_create_count'].default == 0
    assert fields['evidence_candidate_count'].default == 0
    assert fields['evidence_rejected_count'].default == 0
