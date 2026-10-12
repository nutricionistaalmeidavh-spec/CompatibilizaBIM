import json
from pathlib import Path

from compatibilizabim.exports_cli import main


def _store(path: Path) -> None:
    path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "issues": [
                    {
                        "issue_id": "CBIM-ABC123",
                        "source_key": "abc",
                        "project_id": "P1",
                        "obra_id": "O1",
                        "title": "Tubo x viga",
                        "source_rule_id": "r1",
                        "source_rule_name": "Tubo x Viga",
                        "severity": "critical",
                        "status": "open",
                        "discipline_a": "MEP",
                        "discipline_b": "Structure",
                        "file_a": "mep.ifc",
                        "file_b": "str.ifc",
                        "a_global_id": "0AAAAAAAAAAAAAAAAAAAAA",
                        "b_global_id": "1BBBBBBBBBBBBBBBBBBBBB",
                        "a_ifc_class": "IfcPipeSegment",
                        "b_ifc_class": "IfcBeam",
                        "a_name": "Tubo",
                        "b_name": "Viga",
                        "point": [1, 2, 3],
                        "depth_m": 0.05,
                        "storey": "P1",
                        "assignee": None,
                        "due_date": None,
                        "ignored_reason": None,
                        "viewpoint": None,
                        "screenshot": None,
                        "comments": [],
                        "created_at": "2026-08-15T10:00:00+00:00",
                        "updated_at": "2026-08-15T10:00:00+00:00"
                    }
                ]
            }
        ),
        encoding="utf-8",
    )


def test_export_cli_all_writes_three_formats(tmp_path, capsys):
    store = tmp_path / "issues.json"
    out = tmp_path / "exports"
    _store(store)

    code = main(["all", str(store), str(out), "--author", "coord@example.com"])

    assert code == 0
    assert (out / "issues.bcf").exists()
    assert (out / "issues.csv").exists()
    assert (out / "issues.pdf").exists()
    text = capsys.readouterr().out
    assert "1 issue" in text


def test_export_cli_bcf_requires_author(tmp_path):
    store = tmp_path / "issues.json"
    _store(store)

    try:
        main(["bcf", str(store), str(tmp_path / "out.bcf")])
    except SystemExit as exc:
        assert exc.code == 2
    else:
        raise AssertionError("CLI deveria exigir --author para BCF")


def test_export_cli_all_does_not_publish_partial_files_on_failure(tmp_path, monkeypatch):
    from compatibilizabim import exports_cli

    store = tmp_path / "issues.json"
    out = tmp_path / "exports"
    _store(store)

    def fail_pdf(*args, **kwargs):
        raise RuntimeError("pdf unavailable")

    monkeypatch.setattr(exports_cli.ExportService, "write_pdf", fail_pdf)

    try:
        exports_cli.main(["all", str(store), str(out), "--author", "coord@example.com"])
    except RuntimeError as exc:
        assert "pdf unavailable" in str(exc)
    else:
        raise AssertionError("Falha de PDF deveria propagar")

    assert not (out / "issues.bcf").exists()
    assert not (out / "issues.csv").exists()
    assert not (out / "issues.pdf").exists()
