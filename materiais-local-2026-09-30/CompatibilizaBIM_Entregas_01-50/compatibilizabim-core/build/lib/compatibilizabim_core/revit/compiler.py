from __future__ import annotations

from collections import defaultdict
from typing import Any

from cbim_sdk.models import (
    Beam,
    Column,
    Door,
    Equipment,
    Fitting,
    Furniture,
    Opening,
    Pipe,
    SanitaryTerminal,
    Slab,
    Space,
    Stair,
    Wall,
    Window,
)

from .models import RevitBuildDiagnostic, RevitBuildOperation, RevitBuildPlan


def _pt(p) -> dict[str, float]:
    return {"x": float(p.x), "y": float(p.y), "z": float(p.z)}


def _refs(element) -> list[dict[str, Any]]:
    return [r.model_dump(mode="json", exclude_none=True) for r in getattr(element, "source_refs", [])]


class RevitBuildPlanCompiler:
    def __init__(self, *, revit_version: int = 2027, preferred_manufacturer: str | None = None):
        self.revit_version = int(revit_version)
        self.preferred_manufacturer = preferred_manufacturer

    def compile(self, project) -> RevitBuildPlan:
        storeys = {s.id: s for s in project.storeys}
        systems = {s.id: s for s in project.systems}
        operations: list[RevitBuildOperation] = []
        diagnostics: list[RevitBuildDiagnostic] = []

        for storey in sorted(project.storeys, key=lambda s: (s.elevation, s.name, s.id)):
            operations.append(
                RevitBuildOperation(
                    id=f"level:{storey.id}",
                    cbim_id=storey.id,
                    action="ensure_level",
                    category="Levels",
                    storey_id=storey.id,
                    level_name=storey.name,
                    parameters={"elevation_m": float(storey.elevation), "height_m": float(storey.height)},
                )
            )

        for element in project.elements:
            storey = storeys.get(element.storey_id) if element.storey_id else None
            level_name = storey.name if storey else None
            common = {
                "storey_id": element.storey_id,
                "level_name": level_name,
                "source_refs": _refs(element),
            }
            if isinstance(element, Wall):
                operations.append(RevitBuildOperation(
                    id=f"wall:{element.id}", cbim_id=element.id, action="create_wall", category="Walls",
                    geometry={"start": _pt(element.start), "end": _pt(element.end)},
                    parameters={"height_m": float(element.height), "thickness_m": float(element.thickness), "confidence": float(element.confidence), "review_state": element.review_state, **element.properties},
                    **common,
                ))
            elif isinstance(element, Slab):
                operations.append(RevitBuildOperation(
                    id=f"floor:{element.id}", cbim_id=element.id, action="create_floor", category="Floors",
                    geometry={"boundary": [_pt(p) for p in element.boundary]},
                    parameters={"thickness_m": float(element.thickness), "confidence": float(element.confidence), "review_state": element.review_state, **element.properties},
                    **common,
                ))
            elif isinstance(element, Pipe):
                if len(element.path) < 2:
                    diagnostics.append(RevitBuildDiagnostic(severity="error", code="pipe_path_too_short", message="Pipe has fewer than two path points", cbim_ids=[element.id]))
                    continue
                system = systems.get(element.system_id) if element.system_id else None
                for i, (a, b) in enumerate(zip(element.path, element.path[1:])):
                    operations.append(RevitBuildOperation(
                        id=f"pipe:{element.id}:{i}", cbim_id=element.id, action="create_pipe", category="Pipes",
                        geometry={"start": _pt(a), "end": _pt(b)},
                        parameters={
                            "segment_index": i,
                            "diameter_m": float(element.diameter),
                            "slope": element.slope,
                            "system_id": element.system_id,
                            "system_name": system.name if system else None,
                            "system_classification": system.classification if system else None,
                            "confidence": float(element.confidence),
                            "review_state": element.review_state,
                            **element.properties,
                        },
                        **common,
                    ))
            elif isinstance(element, Fitting):
                system = systems.get(element.system_id) if element.system_id else None
                query = {
                    "semantic_class": "pipe_fitting",
                    "subtype": element.fitting_type,
                    "system": system.classification if system else None,
                    "nominal_diameter_m": element.nominal_diameter,
                    "revit_version": self.revit_version,
                    "manufacturer": self.preferred_manufacturer,
                }
                operations.append(RevitBuildOperation(
                    id=f"fitting:{element.id}", cbim_id=element.id, action="create_fitting", category="Pipe Fittings",
                    geometry={"position": _pt(element.position)}, family_query=query,
                    parameters={"fitting_type": element.fitting_type, "nominal_diameter_m": element.nominal_diameter, "system_id": element.system_id, "system_name": system.name if system else None, "confidence": float(element.confidence), "review_state": element.review_state, **element.properties},
                    **common,
                ))
            elif isinstance(element, SanitaryTerminal):
                system = systems.get(element.system_id) if element.system_id else None
                operations.append(RevitBuildOperation(
                    id=f"family:{element.id}", cbim_id=element.id, action="place_family_instance", category="Plumbing Fixtures",
                    geometry={"position": _pt(element.position), "rotation_deg": float(element.rotation_deg)},
                    family_query={"semantic_class": "sanitary_terminal", "subtype": element.terminal_type, "system": system.classification if system else None, "revit_version": self.revit_version, "manufacturer": self.preferred_manufacturer},
                    parameters={"width_m": float(element.width), "depth_m": float(element.depth), "height_m": float(element.height), "system_id": element.system_id, **element.properties},
                    **common,
                ))
            elif isinstance(element, Equipment):
                operations.append(RevitBuildOperation(
                    id=f"family:{element.id}", cbim_id=element.id, action="place_family_instance", category="Mechanical Equipment",
                    geometry={"position": _pt(element.position), "rotation_deg": float(element.rotation_deg)},
                    family_query={"semantic_class": "equipment", "subtype": element.equipment_type, "revit_version": self.revit_version, "manufacturer": self.preferred_manufacturer},
                    parameters={"system_id": element.system_id, **element.properties}, **common,
                ))
            elif isinstance(element, Furniture):
                operations.append(RevitBuildOperation(
                    id=f"family:{element.id}", cbim_id=element.id, action="place_family_instance", category="Furniture",
                    geometry={"position": _pt(element.position), "rotation_deg": float(element.rotation_deg)},
                    family_query={"semantic_class": "furniture", "subtype": element.furniture_type, "revit_version": self.revit_version, "manufacturer": self.preferred_manufacturer},
                    parameters={"width_m": float(element.width), "depth_m": float(element.depth), "height_m": float(element.height), **element.properties}, **common,
                ))
            elif isinstance(element, Stair):
                operations.append(RevitBuildOperation(
                    id=f"stair:{element.id}", cbim_id=element.id, action="create_stair_candidate", category="Stairs",
                    geometry={"boundary": [_pt(p) for p in element.boundary]},
                    parameters={"width_m": float(element.width), "riser_count": int(element.riser_count), "tread_depth_m": float(element.tread_depth), "height_m": float(element.height), "direction_deg": float(element.direction_deg), **element.properties}, **common,
                ))
            elif isinstance(element, Column):
                operations.append(RevitBuildOperation(id=f"column:{element.id}", cbim_id=element.id, action="create_column", category="Structural Columns", geometry={"center": _pt(element.center), "rotation_deg": float(element.rotation_deg)}, parameters={"width_m": float(element.width), "depth_m": float(element.depth), "height_m": float(element.height), **element.properties}, **common))
            elif isinstance(element, Beam):
                operations.append(RevitBuildOperation(id=f"beam:{element.id}", cbim_id=element.id, action="create_beam", category="Structural Framing", geometry={"start": _pt(element.start), "end": _pt(element.end)}, parameters={"width_m": float(element.width), "height_m": float(element.height), **element.properties}, **common))
            elif isinstance(element, Opening):
                operations.append(RevitBuildOperation(id=f"opening:{element.id}", cbim_id=element.id, action="create_opening", category="Openings", geometry={"position": _pt(element.position)}, parameters={"width_m": float(element.width), "height_m": float(element.height), "depth_m": element.depth, "host_id": element.host_id, **element.properties}, **common))
            elif isinstance(element, Space):
                operations.append(RevitBuildOperation(id=f"space:{element.id}", cbim_id=element.id, action="create_space", category="Spaces", geometry={"boundary": [_pt(p) for p in element.boundary]}, parameters={"height_m": float(element.height), **element.properties}, **common))
            elif isinstance(element, (Door, Window)):
                subtype = "door" if isinstance(element, Door) else "window"
                query = {"semantic_class": subtype, "subtype": subtype, "revit_version": self.revit_version, "manufacturer": self.preferred_manufacturer}
                geom = {"position": _pt(element.position), "rotation_deg": float(element.rotation_deg)}
                params = {"width_m": float(element.width), "height_m": float(element.height), "host_id": element.host_id, **element.properties}
                if isinstance(element, Window):
                    params["sill_height_m"] = float(element.sill_height)
                operations.append(RevitBuildOperation(id=f"family:{element.id}", cbim_id=element.id, action="place_family_instance", category="Doors" if subtype == "door" else "Windows", geometry=geom, family_query=query, parameters=params, **common))
            else:
                diagnostics.append(RevitBuildDiagnostic(severity="warning", code="unsupported_element", message=f"No native Revit mapping for {type(element).__name__}", cbim_ids=[element.id]))

        # deterministic operation order: levels first, then source element order while pipe segments remain adjacent.
        counts = defaultdict(int)
        for op in operations:
            counts[op.action] += 1
        return RevitBuildPlan(
            revit_version=self.revit_version,
            project_id=project.id,
            project_name=project.name,
            coordinate_reference=project.coordinate_reference,
            operations=operations,
            diagnostics=diagnostics,
            metadata={"operation_counts": dict(sorted(counts.items())), "cbim_schema_version": project.schema_version},
        )
