from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe, Fitting
from compatibilizabim_core.cad.model import CadDocument, CadLine, CadInsert, CadText, CadPoint
from compatibilizabim_core.mep import HydraulicRecognizer
from compatibilizabim_core.mep.evidence import MepEvidenceEngine


def p(x, y, z=0):
    return CadPoint(x=x, y=y, z=z)


def test_bare_known_pipe_layer_is_candidate_not_auto_created():
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='bare', layer='H-AF-TB', start=p(0,0), end=p(3,0)),
    ])
    evidence = MepEvidenceEngine().assess(doc, 'hydraulic')['bare']
    assert evidence.decision == 'candidate'
    assert evidence.create is False
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    assert not [e for e in out.elements if isinstance(e, Pipe)]
    assert out.metadata['hydraulic_evidence_candidate_count'] == 1


def test_dn_text_is_independent_evidence_and_creates_pipe():
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='pipe', layer='H-AF-TB', start=p(0,0), end=p(3,0)),
        CadText(id='txt', layer='TEXTO', text='AF Ø32 PVC', position=p(1.5,0.12)),
    ])
    evidence = MepEvidenceEngine().assess(doc, 'hydraulic')['pipe']
    assert evidence.decision == 'auto_create'
    assert evidence.strong_evidence_count >= 1
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    pipes = [e for e in out.elements if isinstance(e, Pipe)]
    assert len(pipes) == 1
    assert round(pipes[0].diameter * 1000) == 32


def test_unknown_cx_block_is_candidate_not_fitting():
    doc = CadDocument(source_id='x', entities=[
        CadInsert(id='cx', layer='H-AF-CX', block_name='BLOCO_GENERICO_001', position=p(1,0)),
    ])
    evidence = MepEvidenceEngine().assess(doc, 'hydraulic')['cx']
    assert evidence.decision == 'candidate'
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    assert not [e for e in out.elements if isinstance(e, Fitting)]


def test_recognized_fitting_block_is_auto_created():
    doc = CadDocument(source_id='x', entities=[
        CadInsert(id='elbow', layer='H-AF-CX', block_name='H-U-AF-TB_COR0900_25', position=p(2,0)),
    ])
    evidence = MepEvidenceEngine().assess(doc, 'hydraulic')['elbow']
    assert evidence.decision == 'auto_create'
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    fittings = [e for e in out.elements if isinstance(e, Fitting)]
    assert len(fittings) == 1
    assert fittings[0].fitting_type == 'elbow'


def test_strong_seed_propagates_only_along_collinear_same_system_continuation():
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='seed', layer='H-AF-TB', start=p(0,0), end=p(2,0)),
        CadLine(id='cont', layer='H-AF-TB', start=p(2,0), end=p(4,0)),
        CadLine(id='turn', layer='H-AF-TB', start=p(4,0), end=p(4,2)),
        CadText(id='txt', layer='TEXTO', text='AF DN25', position=p(1,0.1)),
    ])
    evidence = MepEvidenceEngine().assess(doc, 'hydraulic')
    assert evidence['seed'].decision == 'auto_create'
    assert evidence['cont'].decision == 'auto_create'
    assert evidence['cont'].network_seeded is True
    assert evidence['turn'].decision == 'candidate'


def test_repetitive_stair_pattern_stays_rejected_without_direct_evidence():
    entities=[CadLine(id=f's{i}',layer='H-AF-TB',start=p(0,i*.20),end=p(1,i*.20)) for i in range(7)]
    evidence=MepEvidenceEngine().assess(CadDocument(source_id='x',entities=entities),'hydraulic')
    assert all(ev.decision == 'reject' for ev in evidence.values())
    out=HydraulicRecognizer().recognize(CadDocument(source_id='x',entities=entities),CBIMProject(name='P'))
    assert not [e for e in out.elements if isinstance(e,Pipe)]
    assert out.metadata['hydraulic_evidence_rejected_count'] == 7
