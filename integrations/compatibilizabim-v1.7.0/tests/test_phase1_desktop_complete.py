from __future__ import annotations

import json
import time
from pathlib import Path

from compatibilizabim.desktop_service import DesktopService

VALID_IFC = b"ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"


def _wait(service: DesktopService, project_id: str, job_id: str, timeout: float = 2.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = service.get_job(project_id, job_id)
        if job["status"] in {"completed", "failed", "cancelled", "interrupted"}:
            return job
        time.sleep(0.01)
    raise AssertionError("job timeout")


def _report(file_a: Path, file_b: Path, point_x: float = 1.0) -> dict:
    return {
        "file_a": str(file_a),
        "file_b": str(file_b),
        "unique_clash_count": 1,
        "clashes": [
            {
                "rule_id": "pipe-beam",
                "rule_name": "Tubulação × Viga",
                "severity": "high",
                "a_global_id": "PIPE-1",
                "b_global_id": "BEAM-1",
                "a_ifc_class": "IfcPipeSegment",
                "b_ifc_class": "IfcBeam",
                "a_name": "Tubo 100",
                "b_name": "Viga V1",
                "point": [point_x, 2.0, 3.0],
                "depth_m": 0.08,
            }
        ],
    }


def test_rules_completion_imports_issues_and_creates_revision(tmp_path: Path) -> None:
    def runner(file_a, file_b, preset, out_path, ctx):
        payload = _report(file_a, file_b)
        out_path.write_text(json.dumps(payload), encoding="utf-8")
        return payload

    service = DesktopService(tmp_path / "data", rules_runner=runner)
    project = service.create_project("Hospital", obra_id="OBRA-1")
    a = service.import_model_bytes(project["project_id"], "mep.ifc", VALID_IFC, discipline="MEP")
    b = service.import_model_bytes(project["project_id"], "str.ifc", VALID_IFC + b" ", discipline="Structure")

    job = service.start_rules(project["project_id"], a["model_id"], b["model_id"])
    done = _wait(service, project["project_id"], job["job_id"])

    assert done["status"] == "completed"
    assert done["result"]["issues_created"] == 1
    assert done["result"]["revision_id"].startswith("REV-")
    issues = service.list_issues(project["project_id"])
    assert len(issues) == 1
    assert issues[0]["obra_id"] == "OBRA-1"
    revisions = service.list_revisions(project["project_id"])
    assert len(revisions) == 1


def test_issue_edit_comment_and_revision_comparison_are_available_from_desktop_service(tmp_path: Path) -> None:
    counter = 0

    def runner(file_a, file_b, preset, out_path, ctx):
        nonlocal counter
        counter += 1
        payload = _report(file_a, file_b, point_x=float(counter))
        if counter == 2:
            payload["clashes"].append(
                {
                    "rule_id": "duct-column",
                    "rule_name": "Duto × Pilar",
                    "severity": "critical",
                    "a_global_id": "DUCT-2",
                    "b_global_id": "COL-2",
                    "a_ifc_class": "IfcDuctSegment",
                    "b_ifc_class": "IfcColumn",
                    "point": [5, 6, 7],
                    "depth_m": 0.03,
                }
            )
            payload["unique_clash_count"] = 2
        out_path.write_text(json.dumps(payload), encoding="utf-8")
        return payload

    service = DesktopService(tmp_path / "data", rules_runner=runner)
    project = service.create_project("P")
    a = service.import_model_bytes(project["project_id"], "a.ifc", VALID_IFC)
    b = service.import_model_bytes(project["project_id"], "b.ifc", VALID_IFC + b" ")

    first = _wait(service, project["project_id"], service.start_rules(project["project_id"], a["model_id"], b["model_id"])["job_id"])
    issue = service.list_issues(project["project_id"])[0]
    updated = service.update_issue(project["project_id"], issue["issue_id"], status="in_review", assignee="Victor", due_date="2026-08-30")
    assert updated["status"] == "in_review"
    commented = service.add_issue_comment(project["project_id"], issue["issue_id"], author="Victor", text="Revisar rota")
    assert commented["comments"][-1]["text"] == "Revisar rota"

    second = _wait(service, project["project_id"], service.start_rules(project["project_id"], a["model_id"], b["model_id"])["job_id"])
    comparison = service.compare_revisions(project["project_id"], first["result"]["revision_id"], second["result"]["revision_id"])
    assert comparison["counts"] == {"new": 1, "persistent": 1, "resolved": 0}
