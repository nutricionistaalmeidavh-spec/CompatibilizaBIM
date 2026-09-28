from pathlib import Path

from compatibilizabim.issues_cli import build_parser


def test_issues_cli_parses_import_update_comment_and_list():
    parser = build_parser()

    imported = parser.parse_args(["import", "rules.json", "--project", "P1", "--obra-id", "O1", "--store", "issues.json"])
    updated = parser.parse_args(["update", "CBIM-123", "--status", "resolved", "--assignee", "Coordenação", "--store", "issues.json"])
    commented = parser.parse_args(["comment", "CBIM-123", "--author", "Victor", "--text", "Corrigido", "--store", "issues.json"])
    listed = parser.parse_args(["list", "--status", "open", "--store", "issues.json"])

    assert imported.command == "import" and imported.report == Path("rules.json")
    assert imported.project == "P1" and imported.obra_id == "O1"
    assert updated.status == "resolved"
    assert commented.author == "Victor"
    assert listed.status == "open"


def test_issues_cli_end_to_end(tmp_path, capsys):
    import json
    from compatibilizabim.issues_cli import main
    from compatibilizabim.issues import IssueStore

    report = tmp_path / "rules.json"
    store = tmp_path / "issues.json"
    report.write_text(json.dumps({
        "file_a": "mep.ifc", "file_b": "str.ifc",
        "clashes": [{
            "rule_id": "r1", "rule_name": "Tubo x Viga", "severity": "critical",
            "a_global_id": "A", "b_global_id": "B",
            "a_ifc_class": "IfcPipeSegment", "b_ifc_class": "IfcBeam",
            "point": [0, 0, 0], "depth_m": 0.02
        }]
    }), encoding="utf-8")

    assert main(["import", str(report), "--project", "P1", "--store", str(store)]) == 0
    issue_id = IssueStore(store).load()[0].issue_id
    assert main(["update", issue_id, "--status", "in_review", "--store", str(store)]) == 0
    assert main(["comment", issue_id, "--author", "Victor", "--text", "Revisar", "--store", str(store)]) == 0
    assert main(["list", "--status", "in_review", "--store", str(store)]) == 0

    output = capsys.readouterr().out
    assert issue_id in output
    assert "in_review" in output
