import pytest
from compatibilizabim_core.cad.model import CadDocument,CadLine,CadPoint
from compatibilizabim_core.xref import XrefComposer,XrefNode,CadTransform

def simple(sid,eid,x=0):
    return CadDocument(source_id=sid,entities=[CadLine(id=eid,layer='WALL',start=CadPoint(x=x,y=0),end=CadPoint(x=x+1,y=0))])

def test_nested_xrefs_apply_transform_and_namespace_ids():
    child=XrefNode('ARQ',simple('arq','A'),CadTransform(tx=10,rotation_deg=90))
    grand=XrefNode('MEP',simple('mep','A'),CadTransform(tx=2))
    child.children.append(grand)
    root=XrefNode('MASTER',simple('master','A'),children=[child])
    out=XrefComposer().compose(root)
    assert len(out.entities)==3 and len({e.id for e in out.entities})==3 and out.metadata['xref_document_count']==3
    arq=next(e for e in out.entities if e.id=='MASTER/ARQ::A')
    assert arq.start.x==pytest.approx(10) and arq.start.y==pytest.approx(0) and arq.end.x==pytest.approx(10) and arq.end.y==pytest.approx(1)
    mep=next(e for e in out.entities if e.id=='MASTER/ARQ/MEP::A')
    assert mep.start.x==pytest.approx(10) and mep.start.y==pytest.approx(2)

def test_xref_cycle_is_rejected():
    a=XrefNode('A',simple('a','1'));b=XrefNode('B',simple('b','2'));a.children=[b];b.children=[a]
    with pytest.raises(ValueError,match='cycle'):XrefComposer().compose(a)

def test_xref_preserves_block_local_coordinates_for_later_expansion():
    from compatibilizabim_core.cad.model import CadBlock,CadInsert
    from compatibilizabim_core.geometry.blocks import expand_blocks
    block=CadBlock(name='D',entities=[CadLine(id='edge',layer='0',start=CadPoint(x=0,y=0),end=CadPoint(x=1,y=0))])
    d=CadDocument(source_id='d',entities=[CadInsert(id='I',layer='DOOR',block_name='D',position=CadPoint(x=2,y=0))],blocks={'D':block})
    out=XrefComposer().compose(XrefNode('MASTER',d,CadTransform(tx=10,rotation_deg=90)))
    expanded=expand_blocks(out)
    line=expanded.entities[0]
    assert line.start.x==pytest.approx(10) and line.start.y==pytest.approx(2)
    assert line.end.x==pytest.approx(10) and line.end.y==pytest.approx(3)
