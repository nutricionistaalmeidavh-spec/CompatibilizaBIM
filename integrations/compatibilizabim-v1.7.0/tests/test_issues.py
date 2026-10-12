import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from compatibilizabim.issues import IssueService, IssueStore


def _rules_report(path: Path) -> None:
    path.write_text(
        json.dumps(
            {
                "file_a": "Projeto_MEP.ifc",
                "file_b": "Projeto_STR.ifc",
                "clashes": [
                    {
                        "rule_id": "pipe-beam",
                        "rule_name": "Tubo x Viga",
                        "severity": "critical",
                        "index": 1,
                        "mode": "intersection",
                        "a_global_id": "PIPE-1",
                        "b_global_id": "BEAM-1",
                        "a_ifc_class": "IfcPipeSegment",
                        "b_ifc_class": "IfcBeam",
                        "a_name": "Tubo H-203",
                        "b_name": "Viga V-12",
                        "clash_type": "pierce",
                        "point": [10.0, 20.0, 3.0],
                        "depth_m": 0.08,
                    },
                    {
                        "rule_id": "duct-slab",
                        "rule_name": "Duto x Laje",
                        "severity": "high",
                        "index": 2,
                        "mode": "intersection",
                        "a_global_id": "DUCT-2",
                        "b_global_id": "SLAB-2",
                        "a_ifc_class": "IfcDuctSegment",
                        "b_ifc_class": "IfcSlab",
                        "a_name": "Duto 2",
                        "b_name": "Laje 2",
                        "clash_type": "pierce",
                        "point": [12.0, 22.0, 4.0],
                        "depth_m": 0.03,
                    },
                ],
            }
        ),
        encoding="utf-8",
    )


def _service() -> IssueService:
    fixed = datetime(2026, 8, 15, 3, 0, tzinfo=timezone.utc)
    return IssueService(clock=lambda: fixed)


def test_import_rule_report_creates_stable_deduplicated_issues(tmp_path):
    report = tmp_path / "rules.json"
    store_path = tmp_path / "issues.json"
    _rules_report(report)
    service = _service()

    first = service.import_rule_report(report, store_path, project_id="RES-001", obra_id="OBRA-42")
    second = service.import_rule_report(report, store_path, project_id="RES-001", obra_id="OBRA-42")
    issues = IssueStore(store_path).load()

    assert first.created == 2
    assert first.existing == 0
    assert second.created == 0
    assert second.existing == 2
    assert len(issues) == 2
    issue = issues[0]
    assert issue.issue_id.startswith("CBIM-")
    assert issue.project_id == "RES-001"
    assert issue.obra_id == "OBRA-42"
    assert issue.status == "open"
    assert issue.discipline_a == "MEP"
    assert issue.discipline_b == "Structure"
    assert issue.a_global_id == "PIPE-1"
    assert issue.b_global_id == "BEAM-1"
    assert issue.point == (10.0, 20.0, 3.0)
    assert issue.created_at == "2026-08-15T03:00:00+00:00"


def test_issue_store_roundtrip_preserves_comments_and_viewpoint(tmp_path):
    report = tmp_path / "rules.json"
    store_path = tmp_path / "issues.json"
    viewpoint = tmp_path / "viewpoint.json"
    _rules_report(report)
    viewpoint.write_text(json.dumps({"target": [1, 2, 3], "yaw": 0.5}), encoding="utf-8")
    service = _service()
    service.import_rule_report(report, store_path, project_id="RES-001")
    issue_id = IssueStore(store_path).load()[0].issue_id

    service.update_issue(
        store_path,
        issue_id,
        status="in_review",
        assignee="Projetista hidráulico",
        due_date="2026-08-21",
        storey="3º Pavimento",
        viewpoint_path=viewpoint,
    )
    service.add_comment(store_path, issue_id, author="Victor", text="Alterar rota da tubulação.")
    issue = IssueStore(store_path).get(issue_id)

    assert issue.status == "in_review"
    assert issue.assignee == "Projetista hidráulico"
    assert issue.due_date == "2026-08-21"
    assert issue.storey == "3º Pavimento"
    assert issue.viewpoint == {"target": [1, 2, 3], "yaw": 0.5}
    assert len(issue.comments) == 1
    assert issue.comments[0].author == "Victor"
    assert issue.comments[0].text == "Alterar rota da tubulação."


def test_ignored_issue_requires_reason_and_reopen_clears_it(tmp_path):
    report = tmp_path / "rules.json"
    store_path = tmp_path / "issues.json"
    _rules_report(report)
    service = _service()
    service.import_rule_report(report, store_path, project_id="RES-001")
    issue_id = IssueStore(store_path).load()[0].issue_id

    with pytest.raises(ValueError, match="motivo"):
        service.update_issue(store_path, issue_id, status="ignored")

    service.update_issue(store_path, issue_id, status="ignored", ignored_reason="Passagem prevista em projeto")
    assert IssueStore(store_path).get(issue_id).ignored_reason == "Passagem prevista em projeto"

    service.update_issue(store_path, issue_id, status="open")
    issue = IssueStore(store_path).get(issue_id)
    assert issue.status == "open"
    assert issue.ignored_reason is None


def test_store_writes_versioned_json_document(tmp_path):
    report = tmp_path / "rules.json"
    store_path = tmp_path / "issues.json"
    _rules_report(report)
    _service().import_rule_report(report, store_path, project_id="RES-001")

    payload = json.loads(store_path.read_text(encoding="utf-8"))
    assert payload["schema_version"] == 1
    assert len(payload["issues"]) == 2
