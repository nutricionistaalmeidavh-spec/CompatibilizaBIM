from cbim_sdk.models import Furniture, SanitaryTerminal, Slab, Stair, Wall
from compatibilizabim_core.architecture import ArchitectureRecognizer
from compatibilizabim_core.cad.model import CadBlock, CadDocument, CadInsert, CadLine, CadPoint, CadPolyline
from compatibilizabim_core.geometry import GeometryEngine
from compatibilizabim_core.topology import TopologyEngine


def p(x,y,z=0): return CadPoint(x=x,y=y,z=z)
def l(i,a,b,layer='ALVENARIA'): return CadLine(id=i,layer=layer,start=p(*a),end=p(*b))


def run(doc):
    cad=GeometryEngine().process(doc,expand_inserts=False)
    return ArchitectureRecognizer().recognize(cad,TopologyEngine().build(cad))


def test_regular_stair_treads_are_reserved_before_wall_pairing():
    entities=[]
    for i in range(8):
        y=i*.28
        entities.append(l(f's{i}',(0,y),(1.20,y),'ALVENARIA'))
    out=run(CadDocument(source_id='stair',entities=entities))
    assert len([e for e in out.elements if isinstance(e,Stair)]) == 1
    assert len([e for e in out.elements if isinstance(e,Wall)]) == 0


def test_pisos_closed_polyline_creates_slab():
    floor=CadPolyline(id='floor',layer='PISOS',points=[p(0,0),p(5,0),p(5,4),p(0,4)],closed=True)
    out=run(CadDocument(source_id='floor',entities=[floor]))
    slabs=[e for e in out.elements if isinstance(e,Slab)]
    assert len(slabs)==1
    assert abs(slabs[0].thickness-.12)<1e-9


def test_sink_and_counter_are_objects_not_walls():
    sink_block=CadBlock(name='PIA_INOX',entities=[l('b1',(0,0),(.6,0),'0')])
    entities=[
        CadInsert(id='sink',layer='LOUCAS',block_name='PIA_INOX',position=p(1,1)),
        CadPolyline(id='counter',layer='BANCADA',points=[p(2,1),p(4,1),p(4,1.6),p(2,1.6)],closed=True),
    ]
    out=run(CadDocument(source_id='fixtures',entities=entities,blocks={'PIA_INOX':sink_block}))
    assert len([e for e in out.elements if isinstance(e,SanitaryTerminal)])==1
    furn=[e for e in out.elements if isinstance(e,Furniture)]
    assert len(furn)==1 and furn[0].furniture_type=='counter'


def test_collinear_touching_wall_fragments_merge_into_one_wall():
    entities=[
        l('a1',(0,0),(2,0)),l('a2',(0,.14),(2,.14)),
        l('b1',(2,0),(4,0)),l('b2',(2,.14),(4,.14)),
    ]
    out=run(CadDocument(source_id='walls',entities=entities))
    walls=[e for e in out.elements if isinstance(e,Wall)]
    assert len(walls)==1
    assert abs(walls[0].length-4.0)<1e-6
