from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe, Point3D, System
from compatibilizabim_core.catalog import CatalogAdvisor, CatalogEnricher, load_brazil_seed


def sample_pipe():
    system=System(name='AF',discipline='plumbing',classification='cold_water')
    pipe=Pipe(path=[Point3D(x=0,y=0),Point3D(x=2,y=0)],diameter=.025,system_id=system.id,properties={'service':'cold_water','material_hint':'PVC'})
    return CBIMProject(name='P',systems=[system],elements=[pipe])


def test_catalog_brasil_covers_priority_manufacturers_and_domains():
    cat=load_brazil_seed()
    manufacturers={i.manufacturer for i in cat.items}
    assert {'Amanco Wavin','Tigre','Krona','Astra','Fortlev','Victaulic','Schneider Electric','Siemens'} <= manufacturers
    assert {'hydraulic','fire','electrical'} <= {str(i.metadata.get('domain')) for i in cat.items}


def test_catalog_advisor_adds_neutral_candidates_without_forcing_brand():
    cat=load_brazil_seed(); project=sample_pipe()
    out=CatalogAdvisor(cat).advise(project)
    pipe=out.elements[0]
    assert pipe.properties['catalog_candidate_count'] >= 2
    assert 'catalog_candidates' in pipe.properties
    assert 'catalog_manufacturer' not in pipe.properties
    assert 'catalog_item_id' not in pipe.properties


def test_catalog_enricher_still_requires_explicit_manufacturer():
    cat=load_brazil_seed(); project=sample_pipe()
    out=CatalogEnricher(cat).enrich(project)
    assert 'catalog_manufacturer' not in out.elements[0].properties


def test_high_catalog_correspondence_is_a_small_intelligence_signal_not_brand_assignment():
    from cbim_sdk.models import SourceRef
    from compatibilizabim_core.intelligence import RecognitionIntelligence
    project=sample_pipe()
    project.elements[0].source_refs=[SourceRef(source_id='cad:x',entity_id='1',metadata={'profile_rule':'af'})]
    project.elements[0].confidence=.90
    advised=CatalogAdvisor(load_brazil_seed()).advise(project)
    decision=RecognitionIntelligence().evaluate(advised)[0]
    assert any(e.name=='catalog_correspondence' for e in decision.evidence)
    assert 'catalog_manufacturer' not in advised.elements[0].properties
