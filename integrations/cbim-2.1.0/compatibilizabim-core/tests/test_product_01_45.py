from pathlib import Path
from cbim_sdk import CBIMProject
from cbim_sdk.models import Wall,Point3D,SourceRef
from compatibilizabim_core.product import ProjectConfiguration,StoreyConfig,build_import_plan,CADProfileLearner,build_conversion_report,build_studio_html

def make_project():
    elements=[]
    for i in range(2):
        elements.append(Wall(id=f'w{i}',start=Point3D(x=i*3,y=0),end=Point3D(x=i*3+2,y=0),thickness=.14,height=2.8,confidence=.92,review_state='confirmed',source_refs=[SourceRef(source_id='cad',entity_id=f'e{i}',layer='A-WALL')]))
    elements.append(Wall(id='w2',start=Point3D(x=0,y=2),end=Point3D(x=2,y=2),thickness=.14,height=2.8,confidence=.62,review_state='auto',source_refs=[SourceRef(source_id='cad',entity_id='e2',layer='A-WALL-UNCERTAIN')]))
    return CBIMProject(name='Produto Demo',elements=elements)

def test_import_wizard_detects_disciplines_and_requires_unknown_confirmation():
    plan=build_import_plan(['Torre_ARQ.dwg','Torre_ESTR.dwg','Torre_HID.dwg','Torre_INC.dwg'])
    assert plan.ready
    assert [s.discipline for s in plan.sources]==['architecture','structure','hydraulic','fire']
    unknown=build_import_plan(['coordenacao.dwg'])
    assert not unknown.ready and unknown.sources[0].discipline=='unknown'
    ordinary_name=build_import_plan(['arquivo.dwg'])
    assert not ordinary_name.ready and ordinary_name.sources[0].discipline=='unknown'

def test_project_configuration_rejects_duplicate_storeys():
    import pytest
    with pytest.raises(ValueError):ProjectConfiguration(storeys=[StoreyConfig(name='Térreo',elevation=0),StoreyConfig(name='térreo',elevation=3)])

def test_profile_learning_uses_only_human_reviewed_observations():
    p=make_project();profile,result=CADProfileLearner().learn(p,min_observations=2)
    assert len(profile.rules)==1
    assert profile.rules[0].layer=='A-WALL'
    assert profile.rules[0].target=='wall'
    assert 'A-WALL-UNCERTAIN' not in [c.selector for c in result.candidates]

def test_conversion_report_blocks_auto_elements():
    p=make_project();plan=build_import_plan(['Torre_ARQ.dwg'])
    r=build_conversion_report(p,import_plan=plan)
    assert r.total_elements==3 and r.pending_review==1
    assert not r.ready_to_export
    assert r.element_counts['wall']==3

def test_conversion_report_blocks_empty_or_unidentified_source_projects():
    empty=CBIMProject(name='Projeto vazio',elements=[])
    ready_plan=build_import_plan(['Torre_ARQ.dwg'])
    report=build_conversion_report(empty,import_plan=ready_plan)
    assert not report.ready_to_export
    assert any('não contém elementos' in blocker for blocker in report.blockers)

    reviewed=make_project()
    for element in reviewed.elements: element.review_state='confirmed'
    unknown_plan=build_import_plan(['arquivo.dwg'])
    report=build_conversion_report(reviewed,import_plan=unknown_plan)
    assert not report.ready_to_export
    assert any('disciplina' in blocker.lower() for blocker in report.blockers)

def test_studio_is_self_contained_and_embeds_workflow():
    p=make_project();plan=build_import_plan(['Torre_ARQ.dwg']);r=build_conversion_report(p,import_plan=plan)
    s=build_studio_html(p,plan,r)
    for label in ['Fontes do projeto','Configuração','Revisar reconhecimento','Aprendizado de perfil CAD','Validar e exportar']:
        assert label in s
    assert 'A-WALL' in s and 'reviewed.cbim.json' in s and 'Salvar alterações' in s and "fetch('/api/workspace'" in s
    assert '<script src=' not in s
    assert '"length":' not in s
