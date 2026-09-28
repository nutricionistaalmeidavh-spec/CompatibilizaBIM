import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from compatibilizabim.revisions import RevisionService, RevisionStore


def _write_report(path: Path, rows: list[dict]) -> None:
    path.write_text(
        json.dumps({"file_a": "mep.ifc", "file_b": "str.ifc", "clashes": rows}),
        encoding="utf-8",
    )


def _clash(a: str, b: str, *, rule: str = "r", point=(0, 0, 0), severity="high") -> dict:
    return {
        "rule_id": rule,
        "rule_name": rule,
        "severity": severity,
        "a_global_id": a,
        "b_global_id": b,
        "a_ifc_class": "IfcPipeSegment",
        "b_ifc_class": "IfcBeam",
        "point": list(point),
        "depth_m": 0.02,
    }


def _service() -> RevisionService:
    fixed = datetime(2026, 8, 15, 4, 0, tzinfo=timezone.utc)
    return RevisionService(clock=lambda: fixed)


def test_revision_comparison_classifies_new_persistent_and_resolved(tmp_path):
    r1 = tmp_path / "r1.json"
    r2 = tmp_path / "r2.json"
    store_path = tmp_path / "revisions.json"
    _write_report(r1, [_clash("A", "B"), _clash("C", "D")])
    _write_report(r2, [_clash("B", "A", rule="changed-rule", severity="critical"), _clash("E", "F")])
    service = _service()

    service.add_report(r1, store_path, revision_id="R01", label="Coordenação inicial")
    service.add_report(r2, store_path, revision_id="R02", label="Revisão projetistas")
    result = service.compare(store_path, "R01", "R02")

    assert result.base_revision == "R01"
    assert result.current_revision == "R02"
    assert result.new_count == 1
    assert result.persistent_count == 1
    assert result.resolved_count == 1
    assert result.new[0].a_global_id == "E"
    assert {result.persistent[0].a_global_id, result.persistent[0].b_global_id} == {"A", "B"}
    assert result.persistent[0].severity == "critical"
    assert result.resolved[0].a_global_id == "C"


def test_revision_store_preserves_history_and_rejects_duplicate_id(tmp_path):
    report = tmp_path / "r.json"
    store_path = tmp_path / "revisions.json"
    _write_report(report, [_clash("A", "B")])
    service = _service()

    service.add_report(report, store_path, revision_id="R01")
    with pytest.raises(ValueError, match="já existe"):
        service.add_report(report, store_path, revision_id="R01")

    snapshots = RevisionStore(store_path).load()
    assert len(snapshots) == 1
    assert snapshots[0].revision_id == "R01"
    assert snapshots[0].created_at == "2026-08-15T04:00:00+00:00"


def test_revision_identity_falls_back_to_class_and_rounded_point_without_guids(tmp_path):
    r1 = tmp_path / "r1.json"
    r2 = tmp_path / "r2.json"
    store_path = tmp_path / "revisions.json"
    a = _clash("", "", point=(1.00001, 2.0, 3.0))
    b = _clash("", "", point=(1.00004, 2.0, 3.0), rule="other")
    _write_report(r1, [a])
    _write_report(r2, [b])
    service = _service()

    service.add_report(r1, store_path, revision_id="R01")
    service.add_report(r2, store_path, revision_id="R02")
    result = service.compare(store_path, "R01", "R02")

    assert result.persistent_count == 1
    assert result.new_count == 0
    assert result.resolved_count == 0


def test_revision_store_is_versioned_json(tmp_path):
    report = tmp_path / "r.json"
    store_path = tmp_path / "revisions.json"
    _write_report(report, [_clash("A", "B")])
    _service().add_report(report, store_path, revision_id="R01")

    payload = json.loads(store_path.read_text(encoding="utf-8"))
    assert payload["schema_version"] == 1
    assert len(payload["revisions"]) == 1
