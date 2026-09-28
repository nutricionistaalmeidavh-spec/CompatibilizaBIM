from pathlib import Path

from compatibilizabim.revisions_cli import build_parser


def test_revisions_cli_parses_add_compare_and_list():
    parser = build_parser()
    add = parser.parse_args(["add", "rules.json", "--revision", "R01", "--label", "Inicial", "--store", "revisions.json"])
    compare = parser.parse_args(["compare", "R01", "R02", "--store", "revisions.json", "--out", "comparison.json"])
    listed = parser.parse_args(["list", "--store", "revisions.json"])

    assert add.command == "add" and add.report == Path("rules.json")
    assert add.revision == "R01"
    assert compare.base == "R01" and compare.current == "R02"
    assert compare.out == Path("comparison.json")
    assert listed.command == "list"


def test_revisions_cli_end_to_end(tmp_path, capsys):
    import json
    from compatibilizabim.revisions_cli import main

    r1 = tmp_path / "r1.json"
    r2 = tmp_path / "r2.json"
    store = tmp_path / "revisions.json"
    out = tmp_path / "comparison.json"
    common = {
        "rule_id": "r1", "rule_name": "Tubo x Viga", "severity": "high",
        "a_ifc_class": "IfcPipeSegment", "b_ifc_class": "IfcBeam",
        "point": [0, 0, 0], "depth_m": 0.01,
    }
    r1.write_text(json.dumps({"file_a":"mep.ifc","file_b":"str.ifc","clashes":[{**common,"a_global_id":"A","b_global_id":"B"}]}), encoding="utf-8")
    r2.write_text(json.dumps({"file_a":"mep.ifc","file_b":"str.ifc","clashes":[{**common,"a_global_id":"C","b_global_id":"D"}]}), encoding="utf-8")

    assert main(["add", str(r1), "--revision", "R01", "--store", str(store)]) == 0
    assert main(["add", str(r2), "--revision", "R02", "--store", str(store)]) == 0
    assert main(["compare", "R01", "R02", "--store", str(store), "--out", str(out)]) == 0
    assert main(["list", "--store", str(store)]) == 0

    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["counts"] == {"new": 1, "persistent": 0, "resolved": 1}
    text = capsys.readouterr().out
    assert "R01" in text and "R02" in text
