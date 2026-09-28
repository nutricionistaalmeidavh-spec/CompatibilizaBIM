from __future__ import annotations

import csv
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Iterable

from .models import ClashResult
from .preflight import FederationReport
from .rules import RuleRunReport


def _json_ready(result: ClashResult) -> dict[str, Any]:
    data = asdict(result)
    data["p1"] = list(result.p1)
    data["p2"] = list(result.p2)
    data["point"] = list(result.point)
    data["depth_mm"] = round(result.depth_m * 1000.0, 3)
    return data


def write_json(
    path: Path,
    summary: dict[str, Any],
    results: Iterable[ClashResult],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "summary": summary,
        "clashes": [_json_ready(result) for result in results],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_csv(path: Path, results: Iterable[ClashResult]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for result in results:
        rows.append(
            {
                "index": result.index,
                "mode": result.mode,
                "a_global_id": result.a_global_id,
                "b_global_id": result.b_global_id,
                "a_ifc_class": result.a_ifc_class,
                "b_ifc_class": result.b_ifc_class,
                "a_name": result.a_name or "",
                "b_name": result.b_name or "",
                "clash_type": result.clash_type,
                "point_x": result.point[0],
                "point_y": result.point[1],
                "point_z": result.point[2],
                "depth_m": result.depth_m,
                "depth_mm": round(result.depth_m * 1000.0, 3),
            }
        )

    fieldnames = [
        "index",
        "mode",
        "a_global_id",
        "b_global_id",
        "a_ifc_class",
        "b_ifc_class",
        "a_name",
        "b_name",
        "clash_type",
        "point_x",
        "point_y",
        "point_z",
        "depth_m",
        "depth_mm",
    ]
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_preflight_json(path: Path, report: FederationReport) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    models = []
    for model in report.models:
        bbox = None
        if model.bbox is not None:
            bbox = {
                "minimum": list(model.bbox.minimum),
                "maximum": list(model.bbox.maximum),
                "center": list(model.bbox.center),
                "diagonal_m": model.bbox.diagonal_m,
            }
        models.append(
            {
                "path": str(model.path),
                "file": model.path.name,
                "sha256": model.sha256,
                "schema": model.schema,
                "unit_scale_m": model.unit_scale_m,
                "element_count": model.element_count,
                "geometry_count": model.geometry_count,
                "storeys": list(model.storeys),
                "discipline": model.discipline,
                "bbox": bbox,
            }
        )

    payload = {
        "aligned": report.aligned,
        "alignment_tolerance_m": report.alignment_tolerance_m,
        "models": models,
        "warnings": [
            {
                "code": warning.code,
                "message": warning.message,
                "files": list(warning.files),
            }
            for warning in report.warnings
        ],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_rule_report_json(path: Path, report: RuleRunReport, *, preset: str | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "file_a": str(report.file_a),
        "file_b": str(report.file_b),
        "preset": preset,
        "rule_count": len(report.rules),
        "raw_clash_count": report.raw_clash_count,
        "unique_clash_count": report.unique_clash_count,
        "rules": [
            {
                "rule_id": rule.rule_id,
                "name": rule.name,
                "class_a": rule.class_a,
                "class_b": rule.class_b,
                "mode": rule.mode,
                "tolerance_m": rule.tolerance,
                "clearance_m": rule.clearance,
                "severity": rule.severity,
            }
            for rule in report.rules
        ],
        "clashes": [
            {
                "rule_id": item.rule_id,
                "rule_name": item.rule_name,
                "severity": item.severity,
                "index": item.clash.index,
                "mode": item.clash.mode,
                "a_global_id": item.clash.a_global_id,
                "b_global_id": item.clash.b_global_id,
                "a_ifc_class": item.clash.a_ifc_class,
                "b_ifc_class": item.clash.b_ifc_class,
                "a_name": item.clash.a_name,
                "b_name": item.clash.b_name,
                "clash_type": item.clash.clash_type,
                "point": list(item.clash.point),
                "depth_m": item.clash.depth_m,
                "depth_mm": round(item.clash.depth_m * 1000.0, 3),
            }
            for item in report.clashes
        ],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
