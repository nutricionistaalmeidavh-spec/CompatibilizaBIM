from compatibilizabim_core.validation import ValidationCase,ValidationThresholds

def test_real_project_evidence_is_explicit_not_inferred():
    c=ValidationCase(name='client',discipline='architecture',source_path='client.dwg',evidence_kind='real_project',thresholds=ValidationThresholds())
    assert c.evidence_kind=='real_project'
