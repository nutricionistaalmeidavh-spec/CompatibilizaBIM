from compatibilizabim_core.cad.model import CadDocument,CadInsert,CadPoint,CadLine
from compatibilizabim_core.profiles import CadProfile,CadProfileEngine,CadRule
def test_profile_classifies_layer_and_block_and_roundtrips(tmp_path):
    profile=CadProfile(name='Office',organization='ACME',rules=[CadRule(id='af',target='pipe',layer='AF_',system='cold_water',defaults={'diameter_mm':25},priority=2),CadRule(id='door',target='door',block='PORTA',priority=5)])
    path=tmp_path/'profile.json'; profile.save(path); loaded=CadProfile.load(path)
    doc=CadDocument(source_id='x',entities=[CadLine(id='l1',layer='AF_DN25',start=CadPoint(x=0,y=0),end=CadPoint(x=1,y=0)),CadInsert(id='i1',layer='A_PORTA',block_name='PORTA_80',position=CadPoint(x=0,y=0))])
    out=CadProfileEngine().apply(doc,loaded)
    assert out.entities[0].metadata['semantic_target']=='pipe'; assert out.entities[0].metadata['semantic_system']=='cold_water'; assert out.entities[0].metadata['default_diameter_mm']==25; assert out.entities[1].metadata['semantic_target']=='door'; assert out.metadata['cad_profile']=='Office'
