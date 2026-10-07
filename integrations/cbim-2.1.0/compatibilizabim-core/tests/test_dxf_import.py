import ezdxf
import pytest
from ezdxf import units

from compatibilizabim_core import CadArc, CadCircle, CadInsert, CadPolyline, CadSpline, CadText, DXFImporter


def test_dxf_import_normalizes_mm_to_m_and_reads_major_entities(tmp_path):
    path = tmp_path / "sample.dxf"
    doc = ezdxf.new("R2018")
    doc.units = units.MM
    msp = doc.modelspace()
    msp.add_line((0,0), (1000,0), dxfattribs={"layer":"WALL"})
    msp.add_arc((0,0), 500, 0, 90, dxfattribs={"layer":"ARC"})
    msp.add_circle((1000,1000), 250, dxfattribs={"layer":"CIRCLE"})
    msp.add_text("SALA", dxfattribs={"height":200,"layer":"TEXT"}).set_placement((100,100))
    block = doc.blocks.new("DOOR")
    block.add_line((0,0),(800,0), dxfattribs={"layer":"0"})
    msp.add_blockref("DOOR", (2000,0), dxfattribs={"layer":"DOOR"})
    doc.saveas(path)

    cad = DXFImporter().read(path)
    wall = next(e for e in cad.entities if e.kind == "line")
    assert wall.end.x == pytest.approx(1.0)
    assert any(isinstance(e, CadArc) and e.radius == pytest.approx(.5) for e in cad.entities)
    assert any(isinstance(e, CadCircle) and e.radius == pytest.approx(.25) for e in cad.entities)
    assert any(isinstance(e, CadText) and e.height == pytest.approx(.2) for e in cad.entities)
    assert any(isinstance(e, CadInsert) and e.block_name == "DOOR" for e in cad.entities)
    assert "DOOR" in cad.blocks


def test_bulged_polyline_is_flattened_instead_of_losing_curve(tmp_path):
    path = tmp_path / "bulge.dxf"
    doc = ezdxf.new("R2018")
    doc.units = units.M
    msp = doc.modelspace()
    msp.add_lwpolyline([(0,0,1.0),(1,0,0.0)], format="xyb")
    doc.saveas(path)
    cad = DXFImporter().read(path)
    poly = cad.entities[0]
    assert isinstance(poly, CadPolyline)
    assert poly.metadata["flattened_from"] == "LWPOLYLINE"
    assert len(poly.points) > 2
