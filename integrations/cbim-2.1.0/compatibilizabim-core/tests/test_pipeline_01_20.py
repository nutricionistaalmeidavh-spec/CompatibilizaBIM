from compatibilizabim_core.cad.model import CadDocument,CadInsert,CadLine,CadPoint
from compatibilizabim_core.pipeline import CADToCBIMPipeline
from compatibilizabim_core.profiles import CadProfile,CadRule
from compatibilizabim_core.integration import CoreIntegrationGateway

def test_cumulative_pipeline_01_20_catalog_connectivity_intelligence_and_gateway():
    doc=CadDocument(source_id='all',entities=[
      CadLine(id='main',layer='AF_DN25',start=CadPoint(x=0,y=0),end=CadPoint(x=2,y=0)),
      CadLine(id='branch',layer='AF_DN25',start=CadPoint(x=1,y=0),end=CadPoint(x=1,y=1)),
      CadInsert(id='tee',layer='AF_DN25',block_name='TEE_DN25',position=CadPoint(x=1,y=0)),
      CadLine(id='fire',layer='INCENDIO_DN65',start=CadPoint(x=0,y=2),end=CadPoint(x=2,y=2)),
    ])
    profile=CadProfile(name='Office',rules=[CadRule(id='af',target='pipe',layer='AF_',system='cold_water',priority=3)])
    _,_,project=CADToCBIMPipeline().run(doc,profile=profile,preferred_manufacturer='Amanco Wavin')
    assert any(r.type=='connects' for r in project.relations)
    af=[e for e in project.elements if e.properties.get('service')=='cold_water']; assert af and all(e.properties.get('catalog_manufacturer')=='Amanco Wavin' for e in af if e.type=='pipe')
    assert project.metadata['recognition_intelligence']=='deterministic_evidence_v2'
    snap=CoreIntegrationGateway().snapshot(project); assert snap.quantities.totals_by_type['pipe']['length_m']>=5 and snap.network_count==2
