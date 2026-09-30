from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe

from compatibilizabim_core.cad.model import CadDocument, CadLine, CadPoint, CadText
from compatibilizabim_core.mep import HydraulicRecognizer
from compatibilizabim_core.mep.text_intelligence import TextEvidenceIndex, parse_text_facts


def p(x, y, z=0):
    return CadPoint(x=x, y=y, z=z)


def test_parse_metric_diameter_material_system_and_height():
    facts = parse_text_facts('AF Ø32 PVC h=500mm')
    assert facts.diameter_mm == 32
    assert facts.material == 'PVC'
    assert 'cold_water' in facts.systems
    assert facts.height_m == 0.5


def test_parse_fractional_inch_diameter():
    facts = parse_text_facts('AF 3/4" PPR')
    assert round(facts.diameter_mm, 2) == 19.05
    assert facts.diameter_source == 'inch_fraction'
    assert facts.material == 'PPR'


def test_parse_level_and_vertical_directives():
    up = parse_text_facts('PRUMADA SOBE - NÍVEL +3,15')
    down = parse_text_facts('DESCE COTA 595,52')
    assert up.vertical_directive == 'up'
    assert up.elevation_m == 3.15
    assert down.vertical_directive == 'down'
    assert down.elevation_m == 595.52


def test_nearest_text_facts_are_associated_to_line():
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='pipe', layer='H-AF-TB', start=p(0,0), end=p(3,0)),
        CadText(id='near', layer='TEXTO', text='AF DN40 CPVC h=0,80m', position=p(1.5,0.10)),
        CadText(id='far', layer='TEXTO', text='AF DN100 PVC h=3,00m', position=p(1.5,2.0)),
    ])
    idx = TextEvidenceIndex(doc, radius_m=0.60)
    assoc = idx.for_entity(doc.entities[0])
    assert assoc.diameter_mm == 40
    assert assoc.material == 'CPVC'
    assert assoc.height_m == 0.80
    assert assoc.text_ids == ('near',)


def test_height_hint_is_preserved_on_cbim_pipe_without_changing_z():
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='pipe', layer='H-AF-TB', start=p(0,0), end=p(3,0)),
        CadText(id='txt', layer='TEXTO', text='AF Ø32 PVC h=813mm SOBE', position=p(1.5,0.10)),
    ])
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    pipes = [e for e in out.elements if isinstance(e, Pipe)]
    assert len(pipes) == 1
    pipe = pipes[0]
    assert pipe.properties['height_hint_m'] == 0.813
    assert pipe.properties['vertical_direction'] == 'up'
    assert pipe.properties['z_reconstruction_pending'] is True
    assert pipe.path[0].z == 0 and pipe.path[1].z == 0


def test_non_mep_height_text_does_not_create_bare_pipe():
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='pipe', layer='H-AF-TB', start=p(0,0), end=p(3,0)),
        CadText(id='txt', layer='TEXTO', text='h=500mm', position=p(1.5,0.10)),
    ])
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    assert not [e for e in out.elements if isinstance(e, Pipe)]


def test_vertical_text_anchor_coordinates_are_preserved_for_z_reconstruction():
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='pipe', layer='H-AF-TB', start=p(0,0), end=p(3,0)),
        CadText(id='txt', layer='TEXTO', text='AF DN25 SOBE', position=p(2.9,0.05)),
    ])
    out = HydraulicRecognizer().recognize(doc, CBIMProject(name='P'))
    pipe = next(e for e in out.elements if isinstance(e, Pipe))
    assert abs(pipe.properties['vertical_anchor_x'] - 2.9) < 1e-9
    assert abs(pipe.properties['vertical_anchor_y'] - 0.05) < 1e-9


def test_vertical_anchor_comes_from_vertical_directive_text_not_nearest_other_semantic_text():
    doc = CadDocument(source_id='x', entities=[
        CadLine(id='pipe', layer='H-AF-TB', start=p(0,0), end=p(3,0)),
        CadText(id='dn', layer='TEXTO', text='AF DN25', position=p(.2,.03)),
        CadText(id='up', layer='TEXTO', text='SOBE', position=p(2.9,.04)),
    ])
    idx=TextEvidenceIndex(doc,radius_m=.60)
    assoc=idx.for_entity(doc.entities[0])
    assert assoc.vertical_directive == 'up'
    assert abs(assoc.anchor_x - 2.9) < 1e-9
    assert abs(assoc.anchor_y - .04) < 1e-9

def test_unitless_height_50_is_interpreted_as_centimetres_for_mep_annotations():
    facts=parse_text_facts('AF DN25 H=50')
    assert abs(facts.height_m-.50)<1e-9


def test_altitude_aliases_el_z_and_cota_tubo_are_parsed():
    assert abs(parse_text_facts('EL=+0,75').elevation_m-.75)<1e-9
    assert abs(parse_text_facts('Z=0.80').elevation_m-.80)<1e-9
    assert abs(parse_text_facts('COTA TUBO +1,20').elevation_m-1.20)<1e-9
