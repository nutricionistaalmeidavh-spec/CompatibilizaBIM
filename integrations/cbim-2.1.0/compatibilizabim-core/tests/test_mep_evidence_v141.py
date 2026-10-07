from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe, Fitting
from compatibilizabim_core.cad.model import CadDocument, CadLine, CadInsert, CadText, CadPoint
from compatibilizabim_core.mep import HydraulicRecognizer
from compatibilizabim_core.mep.semantics import classify_layer_role


def p(x, y, z=0):
    return CadPoint(x=x, y=y, z=z)


def test_architecture_and_stair_layers_are_blocked_from_mep():
    assert classify_layer_role('ALVENARIA') == 'architecture'
    assert classify_layer_role('ESCADA') == 'architecture'
    assert classify_layer_role('PROJEÇÃO') == 'context'
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='stair', layer='ESCADA', start=p(0,0), end=p(2,0)),
        CadLine(id='wall', layer='ALVENARIA', start=p(0,1), end=p(2,1)),
    ])
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    assert not [e for e in out.elements if isinstance(e, Pipe)]


def test_repetitive_stair_like_pattern_is_not_promoted_to_pipes_without_corroboration():
    entities=[CadLine(id=f's{i}',layer='H-AF-TB',start=p(0,i*.20),end=p(1,i*.20)) for i in range(7)]
    doc = CadDocument(source_id='x', entities=entities)
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    assert not [e for e in out.elements if isinstance(e, Pipe)]


def test_single_exact_mep_layer_without_corroboration_is_candidate_in_strict_gate():
    doc = CadDocument(source_id='x', entities=[CadLine(id='bare', layer='H-AF-TB', start=p(0,0), end=p(3,0))])
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    pipes=[e for e in out.elements if isinstance(e, Pipe)]
    assert pipes == []
    assert out.metadata['hydraulic_evidence_candidate_count'] == 1


def test_nearby_dn_text_corroborates_hydraulic_pipe_and_extracts_diameter():
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='pipe', layer='H-AF-TB', start=p(0,0), end=p(3,0)),
        CadText(id='txt', layer='TEXTO', text='AF Ø32 PVC', position=p(1.5,0.15)),
    ])
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    pipes = [e for e in out.elements if isinstance(e, Pipe)]
    assert len(pipes) == 1
    assert round(pipes[0].diameter * 1000) == 32
    assert pipes[0].properties['diameter_source'] == 'nearby_text'
    assert pipes[0].properties['material_hint'] == 'PVC'
    assert pipes[0].properties['evidence_score'] >= 0.70


def test_fitting_block_can_corroborate_connected_pipe():
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='pipe', layer='H-AF-TB', start=p(0,0), end=p(2,0)),
        CadInsert(id='elbow', layer='H-AF-CX', block_name='H-U-AF-TB_COR0900_25', position=p(2,0)),
    ])
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    assert len([e for e in out.elements if isinstance(e, Pipe)]) == 1
    fittings = [e for e in out.elements if isinstance(e, Fitting)]
    assert len(fittings) == 1
    assert fittings[0].fitting_type == 'elbow'
    assert round(fittings[0].nominal_diameter * 1000) == 25
