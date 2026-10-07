from io import StringIO
from cbim_sdk import CBIMProject
from compatibilizabim_core.architecture.recognizer import ArchitectureRecognizer
from compatibilizabim_core.cad.model import CadDocument,CadLine,CadPoint
from compatibilizabim_core.topology.model import TopologyGraph
from compatibilizabim_core.validation.cli import _print_progress


def _line(i,y):
    return CadLine(id=f"l{i}",layer="WALL",start=CadPoint(x=0,y=y,z=0),end=CadPoint(x=10,y=y,z=0))

def test_architecture_wall_candidate_progress_has_numeric_elapsed():
    seen=[]
    def progress(stage,status,elapsed,detail):
        if stage=="architecture_wall_candidates": seen.append((status,elapsed,detail))
    ArchitectureRecognizer().recognize(CadDocument(source_id="x",entities=[_line(1,0),_line(2,.2)]),TopologyGraph(),progress=progress)
    assert seen
    status,elapsed,detail=seen[-1]
    assert status=="done"
    assert isinstance(elapsed,float) and elapsed>=0
    assert detail["candidate_pairs"]>=1

def test_progress_formatter_accepts_missing_elapsed_without_crashing():
    out=StringIO()
    _print_progress("architecture_wall_candidates","done",None,{"candidate_pairs":7},stream=out)
    text=out.getvalue()
    assert "[CBIM] DONE  architecture_wall_candidates" in text
    assert "candidate_pairs=7" in text
    assert "None" not in text
