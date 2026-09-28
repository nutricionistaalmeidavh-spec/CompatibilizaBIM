import json
from pathlib import Path

from compatibilizabim.preflight import BoundingBox, FederationReport, ModelPreflight
from compatibilizabim.preflight_cli import build_parser, main
from compatibilizabim.reporting import write_preflight_json


class FakeBackend:
    def open_model(self, path: Path):
        return path

    def inspect_model(self, model, path: Path):
        return {
            "schema": "IFC4",
            "unit_scale_m": 1.0,
            "element_count": 10,
            "geometry_count": 8,
            "storeys": ("Térreo",),
            "bbox": BoundingBox((0.0, 0.0, 0.0), (10.0, 10.0, 3.0)),
            "class_counts": {"IfcWall": 3},
        }


def test_preflight_parser_accepts_multiple_files_and_tolerance():
    args = build_parser().parse_args(["a.ifc", "b.ifc", "--alignment-tolerance", "2.5"])
    assert [path.name for path in args.files] == ["a.ifc", "b.ifc"]
    assert args.alignment_tolerance == 2.5
    assert args.out.name == "preflight.json"


def test_write_preflight_json_contains_bbox_and_warnings(tmp_path):
    model = ModelPreflight(
        path=tmp_path / "arc.ifc",
        sha256="abc",
        schema="IFC4",
        unit_scale_m=1.0,
        element_count=10,
        geometry_count=8,
        storeys=("Térreo",),
        discipline="Architecture",
        bbox=BoundingBox((0.0, 0.0, 0.0), (10.0, 10.0, 3.0)),
    )
    report = FederationReport((model,), (), True, 5.0)
    path = tmp_path / "preflight.json"

    write_preflight_json(path, report)

    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["aligned"] is True
    assert data["models"][0]["discipline"] == "Architecture"
    assert data["models"][0]["bbox"]["center"] == [5.0, 5.0, 1.5]
    assert data["models"][0]["bbox"]["maximum"] == [10.0, 10.0, 3.0]


def test_preflight_cli_writes_report_with_injected_backend(tmp_path, monkeypatch, capsys):
    a = tmp_path / "ARC.ifc"
    b = tmp_path / "STR.ifc"
    a.write_text("a", encoding="utf-8")
    b.write_text("b", encoding="utf-8")
    out = tmp_path / "preflight.json"

    monkeypatch.setattr("compatibilizabim.preflight_cli.IfcOpenShellBackend", FakeBackend)

    code = main([str(a), str(b), "--out", str(out)])

    assert code == 0
    assert out.exists()
    data = json.loads(out.read_text(encoding="utf-8"))
    assert len(data["models"]) == 2
    assert data["models"][0]["discipline"] == "Architecture"
    assert data["models"][1]["discipline"] == "Structure"
    output = capsys.readouterr().out
    assert "Federação: ALINHADA" in output
