from __future__ import annotations

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


def test_desktop_service_imports_bytes_and_logs(tmp_path: Path) -> None:
    service = DesktopService(tmp_path / "data")
    project = service.create_project("Hospital", obra_id="OBRA-77")

    model = service.import_model_bytes(
        project["project_id"], "estrutura.ifc", VALID_IFC, discipline="Structure"
    )

    assert model["original_name"] == "estrutura.ifc"
    details = service.get_project(project["project_id"])
    assert len(details["models"]) == 1
    logs = service.read_logs(project["project_id"])
    assert any(row["event"] == "model_imported" for row in logs)


def test_desktop_service_rejects_obviously_invalid_ifc(tmp_path: Path) -> None:
    service = DesktopService(tmp_path / "data")
    project = service.create_project("P")

    try:
        service.import_model_bytes(project["project_id"], "fake.ifc", b"not an IFC")
    except ValueError as exc:
        assert "IFC" in str(exc)
    else:
        raise AssertionError("expected invalid IFC")


def test_preflight_job_writes_report_with_injected_runner(tmp_path: Path) -> None:
    calls: list[list[str]] = []

    def runner(paths, out_path, tolerance, ctx):
        calls.append([p.name for p in paths])
        ctx.progress(50, "metade")
        out_path.write_text('{"aligned":true,"models":[],"warnings":[]}', encoding="utf-8")
        return {"aligned": True, "model_count": len(paths)}

    service = DesktopService(tmp_path / "data", preflight_runner=runner)
    project = service.create_project("P")
    service.import_model_bytes(project["project_id"], "a.ifc", VALID_IFC)

    job = service.start_preflight(project["project_id"])
    done = _wait(service, project["project_id"], job["job_id"])

    assert done["status"] == "completed"
    assert done["result"]["model_count"] == 1
    assert Path(done["result"]["report_path"]).is_file()
    assert calls == [["MODEL-" + service.get_project(project["project_id"])["models"][0]["sha256"][:12].upper() + "_a.ifc"]]


def test_viewer_job_reuses_geometry_manifest_cache(tmp_path: Path) -> None:
    calls = 0

    def runner(paths, max_elements, ctx):
        nonlocal calls
        calls += 1
        ctx.progress(60, "malhas")
        return {
            "version": 1,
            "origin": [0, 0, 0],
            "bounds": {"minimum": [0, 0, 0], "maximum": [1, 1, 1]},
            "disciplines": ["Unknown"],
            "elements": [],
            "clashes": [],
        }

    service = DesktopService(tmp_path / "data", viewer_runner=runner)
    project = service.create_project("P")
    service.import_model_bytes(project["project_id"], "a.ifc", VALID_IFC)

    first = service.start_viewer(project["project_id"])
    first_done = _wait(service, project["project_id"], first["job_id"])
    second = service.start_viewer(project["project_id"])
    second_done = _wait(service, project["project_id"], second["job_id"])

    assert first_done["status"] == "completed"
    assert second_done["status"] == "completed"
    assert first_done["result"]["cached"] is False
    assert second_done["result"]["cached"] is True
    assert calls == 1
    assert Path(second_done["result"]["viewer_path"]).is_file()


def test_rules_job_persists_report_with_selected_models(tmp_path: Path) -> None:
    calls = []

    def runner(file_a, file_b, preset, out_path, ctx):
        calls.append((file_a.name, file_b.name, preset))
        ctx.progress(70, "regras")
        out_path.write_text('{"unique_clash_count":2,"clashes":[]}', encoding="utf-8")
        return {"unique_clash_count": 2, "preset": preset}

    service = DesktopService(tmp_path / "data", rules_runner=runner)
    project = service.create_project("P")
    a = service.import_model_bytes(project["project_id"], "mep.ifc", VALID_IFC, discipline="MEP")
    b = service.import_model_bytes(project["project_id"], "str.ifc", VALID_IFC + b"\n ", discipline="Structure")

    job = service.start_rules(project["project_id"], a["model_id"], b["model_id"], preset="mep-structure")
    done = _wait(service, project["project_id"], job["job_id"])

    assert done["status"] == "completed"
    assert done["result"]["unique_clash_count"] == 2
    assert Path(done["result"]["report_path"]).is_file()
    assert calls and calls[0][2] == "mep-structure"
