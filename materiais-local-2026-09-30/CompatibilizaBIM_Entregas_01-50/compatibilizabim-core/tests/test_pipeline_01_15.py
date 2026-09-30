from compatibilizabim_core.cad.model import CadDocument,CadLine,CadPoint
from compatibilizabim_core.pipeline import CADToCBIMPipeline
from cbim_sdk.models import Pipe

def test_cumulative_pipeline_adds_mep_and_storey():
    doc=CadDocument(source_id='all',entities=[CadLine(id='af',layer='AF_DN25',start=CadPoint(x=0,y=0),end=CadPoint(x=2,y=0)),CadLine(id='fire',layer='INCENDIO_DN65',start=CadPoint(x=0,y=1),end=CadPoint(x=2,y=1))])
    _,_,project=CADToCBIMPipeline().run(doc)
    pipes=[e for e in project.elements if isinstance(e,Pipe)]
    assert len(pipes)==2 and all(p.storey_id for p in pipes) and {s.discipline for s in project.systems}=={'plumbing','fire'}
