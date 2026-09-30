from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe,Fitting,Equipment
from compatibilizabim_core.cad.model import CadDocument,CadLine,CadInsert,CadPoint
from compatibilizabim_core.mep import HydraulicRecognizer
def test_hydraulic_recognizes_four_services_and_components():
    es=[CadLine(id=f'l{i}',layer=layer,start=CadPoint(x=0,y=i),end=CadPoint(x=2,y=i)) for i,layer in enumerate(['AF_DN25','AQ_DN20','ESG_DN100','PLUVIAL_DN75'])]
    es += [CadInsert(id='tee',layer='AF_DN25',block_name='TEE_DN25',position=CadPoint(x=1,y=0)),CadInsert(id='valve',layer='AF_DN25',block_name='REGISTRO_GAVETA',position=CadPoint(x=.5,y=0))]
    out=HydraulicRecognizer().recognize(CadDocument(source_id='hyd',entities=es),CBIMProject(name='P')); pipes=[e for e in out.elements if isinstance(e,Pipe)]
    assert len(pipes)==4 and {round(p.diameter*1000) for p in pipes}=={20,25,75,100}; assert len([e for e in out.elements if isinstance(e,Fitting)])==1; assert len([e for e in out.elements if isinstance(e,Equipment)])==1; assert len(out.systems)==4 and all(s.discipline=='plumbing' for s in out.systems)
