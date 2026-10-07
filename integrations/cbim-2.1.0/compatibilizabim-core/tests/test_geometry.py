from shapely.geometry import box

from compatibilizabim_core import (
    CadBlock, CadDocument, CadInsert, CadLine, CadPoint, CadPolyline,
    GeometryEngine, GeometryNormalizer, SpatialIndex, expand_blocks,
)


def line(id, x1,y1,x2,y2, layer="A"):
    return CadLine(id=id, layer=layer, start=CadPoint(x=x1,y=y1), end=CadPoint(x=x2,y=y2))


def test_duplicate_lines_removed_even_when_direction_reversed():
    doc = CadDocument(source_id="x", entities=[line("a",0,0,1,0), line("b",1,0,0,0)])
    out = GeometryNormalizer().normalize(doc)
    assert len(out.entities) == 1


def test_collinear_touching_lines_are_merged():
    doc = CadDocument(source_id="x", entities=[line("a",0,0,1,0), line("b",1,0,2,0)])
    out = GeometryNormalizer().normalize(doc)
    assert len(out.entities) == 1
    merged = out.entities[0]
    assert {merged.start.x, merged.end.x} == {0, 2}


def test_different_layers_are_not_merged():
    doc = CadDocument(source_id="x", entities=[line("a",0,0,1,0,"A"), line("b",1,0,2,0,"B")])
    out = GeometryNormalizer().normalize(doc)
    assert len(out.entities) == 2


def test_intersections_and_contours():
    entities = [
        line("a",0,0,2,0), line("b",2,0,2,2), line("c",2,2,0,2), line("d",0,2,0,0),
        line("e",-1,1,3,1),
    ]
    doc = CadDocument(source_id="x", entities=entities)
    engine = GeometryEngine()
    hits = engine.intersections(doc)
    assert any(set(pair[:2]) == {"b","e"} for pair in hits)
    contours = engine.contours(doc)
    assert contours
    assert contours[-1].area == 2.0  # horizontal splitter creates two 2m² faces


def test_spatial_index_returns_only_nearby_entities():
    entities = [line("near",0,0,1,0), line("far",100,100,101,100)]
    index = SpatialIndex(entities)
    ids = {e.id for e in index.query(box(-1,-1,2,2), predicate="intersects")}
    assert ids == {"near"}


def test_block_expansion_applies_rotation_translation_and_layer_zero_inheritance():
    block = CadBlock(name="B", entities=[line("child",0,0,1,0,layer="0")])
    insert = CadInsert(id="ins", layer="WALL", block_name="B", position=CadPoint(x=10,y=5), rotation_deg=90)
    doc = CadDocument(source_id="x", entities=[insert], blocks={"B": block})
    out = expand_blocks(doc)
    assert len(out.entities) == 1
    child = out.entities[0]
    assert child.layer == "WALL"
    assert child.start.x == 10 and child.start.y == 5
    assert round(child.end.x, 9) == 10
    assert round(child.end.y, 9) == 6


def test_processing_is_deterministic():
    doc = CadDocument(source_id="x", entities=[line("b",1,0,2,0), line("a",0,0,1,0), line("dup",0,0,1,0)])
    engine = GeometryEngine()
    a = engine.process(doc).model_dump_json()
    b = engine.process(doc).model_dump_json()
    assert a == b
