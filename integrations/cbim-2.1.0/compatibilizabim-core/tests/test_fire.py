from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe,Equipment
from compatibilizabim_core.cad.model import CadDocument,CadLine,CadInsert,CadPoint
from compatibilizabim_core.mep import FireRecognizer
def test_fire_recognizes_network_and_heads():
    doc=CadDocument(source_id='fire',entities=[CadLine(id='p',layer='INCENDIO_DN65',start=CadPoint(x=0,y=0),end=CadPoint(x=4,y=0)),CadInsert(id='s',layer='SPRINKLER',block_name='SPRINKLER_HEAD',position=CadPoint(x=1,y=0)),CadInsert(id='h',layer='HIDRANTE',block_name='HIDRANTE',position=CadPoint(x=3,y=0))])
    out=FireRecognizer().recognize(doc,CBIMProject(name='F')); pipes=[e for e in out.elements if isinstance(e,Pipe)]; eq=[e for e in out.elements if isinstance(e,Equipment)]
    assert len(pipes)==1 and round(pipes[0].diameter*1000)==65; assert len(eq)==2 and len(out.systems)==1 and out.systems[0].discipline=='fire'
