import csv
import json

from compatibilizabim.models import ClashResult
from compatibilizabim.reporting import write_csv, write_json


def sample_result():
    return ClashResult(
        index=1,
        mode="intersection",
        a_global_id="A1",
        b_global_id="B1",
        a_ifc_class="IfcPipeSegment",
        b_ifc_class="IfcBeam",
        a_name="Pipe",
        b_name="Beam",
        clash_type="pierce",
        p1=(1.0, 2.0, 3.0),
        p2=(1.0, 2.0, 3.08),
        point=(1.0, 2.0, 3.04),
        depth_m=0.08,
    )


def test_write_json_includes_summary_and_clashes(tmp_path):
    path = tmp_path / "report.json"
    write_json(path, {"count": 1, "mode": "intersection"}, [sample_result()])

    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["summary"]["count"] == 1
    assert data["clashes"][0]["a_global_id"] == "A1"
    assert data["clashes"][0]["point"] == [1.0, 2.0, 3.04]


def test_write_csv_has_one_row_per_clash(tmp_path):
    path = tmp_path / "report.csv"
    write_csv(path, [sample_result()])

    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 1
    assert rows[0]["a_ifc_class"] == "IfcPipeSegment"
    assert rows[0]["depth_mm"] == "80.0"
