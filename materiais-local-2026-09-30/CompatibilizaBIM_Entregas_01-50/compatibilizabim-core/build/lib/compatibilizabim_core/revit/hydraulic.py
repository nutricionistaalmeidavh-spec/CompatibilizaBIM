from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from pydantic import BaseModel, ConfigDict

from .models import RevitBuildDiagnostic, RevitBuildOperation, RevitBuildPlan


class HydraulicRefinementReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    inserted_elbows: int = 0
    inserted_tees: int = 0
    inserted_crosses: int = 0
    inserted_reducers: int = 0
    near_miss_connections: int = 0
    reviewed_nodes: int = 0


def _point_key(point: dict[str, Any], tolerance: float) -> tuple[int, int, int]:
    return (
        round(float(point["x"]) / tolerance),
        round(float(point["y"]) / tolerance),
        round(float(point.get("z", 0.0)) / tolerance),
    )


def _distance(a: dict[str, Any], b: dict[str, Any]) -> float:
    return math.dist((a["x"], a["y"], a.get("z", 0.0)), (b["x"], b["y"], b.get("z", 0.0)))


def _unit_from_node(node: dict[str, Any], other: dict[str, Any]) -> tuple[float, float, float]:
    v = (
        float(other["x"]) - float(node["x"]),
        float(other["y"]) - float(node["y"]),
        float(other.get("z", 0.0)) - float(node.get("z", 0.0)),
    )
    n = math.sqrt(sum(x * x for x in v))
    if n <= 1e-12:
        return (0.0, 0.0, 0.0)
    return tuple(x / n for x in v)


def _angle_deg(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    dot = max(-1.0, min(1.0, sum(x * y for x, y in zip(a, b))))
    return math.degrees(math.acos(dot))


class RevitHydraulicRefiner:
    def __init__(self, *, node_tolerance_m: float = 0.0005, near_miss_tolerance_m: float = 0.01):
        self.node_tolerance_m = node_tolerance_m
        self.near_miss_tolerance_m = near_miss_tolerance_m

    def refine(self, plan: RevitBuildPlan) -> tuple[RevitBuildPlan, HydraulicRefinementReport]:
        out = plan.model_copy(deep=True)
        report = HydraulicRefinementReport()
        pipe_ops = [op for op in out.operations if op.action == "create_pipe"]
        fitting_ops = [op for op in out.operations if op.action == "create_fitting"]

        node_segments: dict[tuple[int, int, int], list[tuple[RevitBuildOperation, dict[str, Any], dict[str, Any]]]] = defaultdict(list)
        node_points: dict[tuple[int, int, int], dict[str, Any]] = {}
        endpoints: list[tuple[RevitBuildOperation, dict[str, Any]]] = []
        for op in pipe_ops:
            start = op.geometry.get("start")
            end = op.geometry.get("end")
            if not start or not end:
                continue
            endpoints.extend([(op, start), (op, end)])
            for node, other in ((start, end), (end, start)):
                key = _point_key(node, self.node_tolerance_m)
                node_points.setdefault(key, node)
                node_segments[key].append((op, node, other))

        fitting_keys: set[tuple[int, int, int]] = set()
        fittings_by_key: dict[tuple[int, int, int], list[RevitBuildOperation]] = defaultdict(list)
        for op in fitting_ops:
            pos = op.geometry.get("position")
            if pos:
                key = _point_key(pos, self.node_tolerance_m)
                fitting_keys.add(key)
                fittings_by_key[key].append(op)

        # Existing CBIM fittings are authoritative semantically, but the native Revit
        # builder still needs the incident pipe operation ids in order to pick their
        # connectors. Enrich those dependencies from topology instead of creating a
        # second synthetic fitting at the same node.
        for key, existing in fittings_by_key.items():
            incident = node_segments.get(key, [])
            pipe_ids = sorted({pipe_op.id for pipe_op, _, _ in incident})
            if len(pipe_ids) < 2:
                continue
            for fitting_op in existing:
                fitting_op.dependencies = pipe_ids
                fitting_op.parameters["topology_dependencies_enriched"] = True

        synthetic: list[RevitBuildOperation] = []
        for key, incident in node_segments.items():
            if len(incident) < 2:
                continue
            report.reviewed_nodes += 1
            if key in fitting_keys:
                continue
            node = node_points[key]
            directions = [_unit_from_node(node, other) for _, _, other in incident]
            diameters = [float(op.parameters.get("diameter_m") or 0.0) for op, _, _ in incident]
            systems = [op.parameters.get("system_classification") for op, _, _ in incident if op.parameters.get("system_classification")]
            system = systems[0] if systems else None
            storey_id = incident[0][0].storey_id
            level_name = incident[0][0].level_name

            if len(incident) == 2:
                angle = _angle_deg(directions[0], directions[1])
                same_d = abs(diameters[0] - diameters[1]) <= 0.0006
                # Opposite directions (~180) are collinear continuation.
                collinear = angle >= 175.0
                if collinear and not same_d:
                    ftype = "reducer"
                    report.inserted_reducers += 1
                    query = {
                        "semantic_class": "pipe_fitting",
                        "subtype": "reducer",
                        "system": system,
                        "connector_count": 2,
                        "revit_version": out.revit_version,
                    }
                    params = {
                        "fitting_type": ftype,
                        "connected_diameters_m": sorted(diameters),
                        "inferred_from_revit_topology": True,
                    }
                elif not collinear and same_d:
                    ftype = "elbow"
                    report.inserted_elbows += 1
                    query = {
                        "semantic_class": "pipe_fitting",
                        "subtype": "elbow",
                        "system": system,
                        "nominal_diameter_m": diameters[0],
                        "angle_deg": round(180.0 - angle, 3),
                        "connector_count": 2,
                        "revit_version": out.revit_version,
                    }
                    params = {
                        "fitting_type": ftype,
                        "nominal_diameter_m": diameters[0],
                        "angle_deg": round(180.0 - angle, 3),
                        "inferred_from_revit_topology": True,
                    }
                elif not collinear and not same_d:
                    out.diagnostics.append(RevitBuildDiagnostic(
                        severity="warning",
                        code="hydraulic_compound_transition_review",
                        message="Direction and diameter change occur at the same node; automatic fitting insertion was withheld.",
                        cbim_ids=sorted({op.cbim_id for op, _, _ in incident if op.cbim_id}),
                        data={"diameters_m": diameters, "angle_deg": angle},
                    ))
                    continue
                else:
                    # Collinear same-DN continuation: never invent a coupling.
                    continue
            elif len(incident) == 3:
                ftype = "tee"
                report.inserted_tees += 1
                query = {
                    "semantic_class": "pipe_fitting",
                    "subtype": "tee",
                    "system": system,
                    "nominal_diameter_m": max(diameters),
                    "connector_count": 3,
                    "revit_version": out.revit_version,
                }
                params = {
                    "fitting_type": ftype,
                    "nominal_diameter_m": max(diameters),
                    "connected_diameters_m": sorted(diameters),
                    "inferred_from_revit_topology": True,
                }
            elif len(incident) == 4:
                ftype = "cross"
                report.inserted_crosses += 1
                query = {
                    "semantic_class": "pipe_fitting",
                    "subtype": "cross",
                    "system": system,
                    "nominal_diameter_m": max(diameters),
                    "connector_count": 4,
                    "revit_version": out.revit_version,
                }
                params = {
                    "fitting_type": ftype,
                    "nominal_diameter_m": max(diameters),
                    "connected_diameters_m": sorted(diameters),
                    "inferred_from_revit_topology": True,
                }
            else:
                out.diagnostics.append(RevitBuildDiagnostic(
                    severity="warning",
                    code="hydraulic_high_degree_node_review",
                    message=f"Hydraulic node has {len(incident)} incident pipe segments and requires review.",
                    cbim_ids=sorted({op.cbim_id for op, _, _ in incident if op.cbim_id}),
                ))
                continue

            synthetic.append(RevitBuildOperation(
                id=f"hydraulic:{ftype}:{key[0]}:{key[1]}:{key[2]}",
                cbim_id=None,
                action="create_fitting",
                category="Pipe Fittings",
                storey_id=storey_id,
                level_name=level_name,
                geometry={"position": {"x": float(node["x"]), "y": float(node["y"]), "z": float(node.get("z", 0.0))}},
                parameters=params,
                family_query=query,
                dependencies=sorted({op.id for op, _, _ in incident}),
            ))

        # Near-miss detection intentionally does not mutate/snap geometry.
        exact_pairs: set[tuple[str, str]] = set()
        for key, incident in node_segments.items():
            ids = sorted({op.id for op, _, _ in incident})
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    exact_pairs.add((ids[i], ids[j]))
        seen_near: set[tuple[str, str]] = set()
        for i, (op_a, point_a) in enumerate(endpoints):
            for op_b, point_b in endpoints[i + 1:]:
                if op_a.id == op_b.id:
                    continue
                pair = tuple(sorted((op_a.id, op_b.id)))
                if pair in exact_pairs or pair in seen_near:
                    continue
                d = _distance(point_a, point_b)
                if self.node_tolerance_m < d <= self.near_miss_tolerance_m:
                    seen_near.add(pair)
                    report.near_miss_connections += 1
                    out.diagnostics.append(RevitBuildDiagnostic(
                        severity="warning",
                        code="hydraulic_near_miss_connection",
                        message=f"Pipe endpoints are {d:.4f} m apart; geometry was not silently snapped.",
                        cbim_ids=sorted({x for x in (op_a.cbim_id, op_b.cbim_id) if x}),
                        data={"distance_m": d, "operation_ids": list(pair)},
                    ))

        # Insert fittings after pipe operations so Revit can create pipe connectors first.
        if synthetic:
            last_pipe = max((i for i, op in enumerate(out.operations) if op.action == "create_pipe"), default=-1)
            out.operations[last_pipe + 1:last_pipe + 1] = synthetic
        out.metadata["hydraulic_refinement"] = report.model_dump(mode="json")
        return out, report
