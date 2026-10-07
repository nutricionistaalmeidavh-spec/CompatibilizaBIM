from compatibilizabim_core.opensource import open_source_capabilities, get_capability
from compatibilizabim_core.mep.external_predictions import external_semantic_hint
from compatibilizabim_core.cad.model import CadLine, CadPoint


def test_open_source_registry_includes_cad_bim_and_ai_resources():
    caps={c.id:c for c in open_source_capabilities()}
    assert caps['acadsharp'].license == 'MIT'
    assert caps['ifcopenshell'].license == 'LGPL-3.0-or-later'
    assert caps['bsdd'].license == 'MIT'
    assert caps['cadtransformer'].license == 'MIT'
    assert caps['vecformer'].license == 'Apache-2.0'
    assert get_capability('sample-test-files').role == 'ifc_validation_samples'
    assert all(not c.bundles_restricted_dataset for c in caps.values())


def test_external_prediction_is_only_a_confidence_bounded_hint():
    e=CadLine(id='x',layer='UNKNOWN',start=CadPoint(x=0,y=0),end=CadPoint(x=1,y=0),metadata={
        'ml_target':'pipe','ml_system':'cold_water','ml_confidence':0.91,'ml_source':'vecformer'
    })
    hint=external_semantic_hint(e)
    assert hint is not None and hint.target == 'pipe' and hint.confidence == 0.91 and hint.source == 'vecformer'
