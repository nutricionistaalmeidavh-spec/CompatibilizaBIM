import json
from pathlib import Path

from compatibilizabim.rules_cli import build_parser, main


class FakeBackend:
    def open_model(self, path: Path):
        return {"path": path.name}

    def select_elements(self, model, ifc_class: str):
        return [f"{model['path']}::{ifc_class}"]

    def build_tree(self, models):
        return "tree"

    def find_clashes(self, tree, group_a, group_b, mode, tolerance, clearance, check_all):
        if group_a[0].endswith("IfcPipeSegment") and group_b[0].endswith("IfcBeam"):
            return [
                {
                    "a_global_id": "PIPE1",
                    "b_global_id": "BEAM1",
                    "a_ifc_class": "IfcPipeSegment",
                    "b_ifc_class": "IfcBeam",
                    "a_name": "Pipe",
                    "b_name": "Beam",
                    "clash_type": "pierce",
                    "p1": [1.0, 2.0, 3.0],
                    "p2": [1.0, 2.0, 3.04],
                    "distance": 0.04,
                }
            ]
        return []


def test_rules_parser_defaults_to_mep_structure():
    args = build_parser().parse_args(["mep.ifc", "structure.ifc"])
    assert args.preset == "mep-structure"
    assert args.fast is False
    assert args.out.name == "rules-report.json"


def test_rules_cli_generates_deduplicated_json(tmp_path, monkeypatch, capsys):
    a = tmp_path / "mep.ifc"
    b = tmp_path / "structure.ifc"
    a.write_text("a", encoding="utf-8")
    b.write_text("b", encoding="utf-8")
    out = tmp_path / "rules.json"

    monkeypatch.setattr("compatibilizabim.rules_cli.IfcOpenShellBackend", FakeBackend)

    code = main([str(a), str(b), "--out", str(out)])

    assert code == 0
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["raw_clash_count"] == 1
    assert data["unique_clash_count"] == 1
    assert data["clashes"][0]["severity"] == "critical"
    assert data["clashes"][0]["a_global_id"] == "PIPE1"
    output = capsys.readouterr().out
    assert "Conflitos únicos: 1" in output
