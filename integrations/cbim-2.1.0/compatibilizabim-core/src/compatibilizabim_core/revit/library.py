from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from .models import RevitBuildDiagnostic, RevitBuildPlan


class LibraryModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, serialize_by_alias=True)


class LibraryFamilyRecord(LibraryModel):
    id: str
    family_path: str
    family_name: str
    type_name: str
    semantic_class: str
    subtype: str | None = None
    manufacturer: str | None = None
    systems: list[str] = Field(default_factory=list)
    materials: list[str] = Field(default_factory=list)
    nominal_diameters_m: list[float] = Field(default_factory=list)
    angles_deg: list[float] = Field(default_factory=list)
    connector_count: int | None = None
    connector_domains: list[str] = Field(default_factory=list)
    revit_versions: list[int] = Field(default_factory=lambda: [2027])
    source: str = "local"
    redistribution: Literal["local-only", "redistributable", "unknown"] = "unknown"
    metadata: dict[str, Any] = Field(default_factory=dict)


class LibraryManifest(LibraryModel):
    schema_name: str = Field(default="CBIM.RevitLibraryManifest", alias="schema", serialization_alias="schema")

    @property
    def schema(self) -> str:
        return self.schema_name
    version: str = "1.0.0"
    roots: list[str] = Field(default_factory=list)
    families: list[LibraryFamilyRecord] = Field(default_factory=list)


class LibraryMatch(LibraryModel):
    record: LibraryFamilyRecord
    score: float = Field(ge=0.0, le=1.0)
    reasons: list[str] = Field(default_factory=list)


class RevitLibraryResolver:
    def __init__(self, manifest: LibraryManifest):
        self.manifest = manifest
        self._roots = [Path(r).expanduser().resolve() for r in manifest.roots]

    def _safe_path(self, value: str) -> Path | None:
        try:
            path = Path(value).expanduser().resolve()
        except Exception:
            return None
        if not path.exists() or path.suffix.casefold() != ".rfa":
            return None
        if not self._roots:
            return None
        if not any(path == root or path.is_relative_to(root) for root in self._roots):
            return None
        return path

    @staticmethod
    def _near(values: list[float], target: float | None, tol: float) -> bool:
        if target is None:
            return True
        if not values:
            return False
        return any(abs(float(v) - float(target)) <= tol for v in values)

    def resolve(self, query: dict[str, Any]) -> LibraryMatch | None:
        semantic = str(query.get("semantic_class") or "").casefold()
        subtype = str(query.get("subtype") or "").casefold()
        revit_version = int(query.get("revit_version") or 2027)
        target_d = query.get("nominal_diameter_m")
        target_a = query.get("angle_deg")
        target_connectors = query.get("connector_count")
        target_system = str(query.get("system") or "").casefold()
        target_material = str(query.get("material") or "").casefold()
        target_manufacturer = str(query.get("manufacturer") or "").casefold()

        matches: list[LibraryMatch] = []
        for record in self.manifest.families:
            safe = self._safe_path(record.family_path)
            if safe is None:
                continue
            if record.semantic_class.casefold() != semantic:
                continue
            if subtype and (record.subtype or "").casefold() not in ("", subtype):
                continue
            if revit_version not in record.revit_versions:
                continue
            if target_d is not None and record.nominal_diameters_m and not self._near(record.nominal_diameters_m, float(target_d), 0.0006):
                continue
            if target_a is not None and record.angles_deg and not self._near(record.angles_deg, float(target_a), 2.0):
                continue
            if target_connectors is not None and record.connector_count is not None and record.connector_count != int(target_connectors):
                continue

            score = 0.55
            reasons = ["semantic_class", "revit_version"]
            if subtype and (record.subtype or "").casefold() == subtype:
                score += 0.10; reasons.append("subtype")
            if target_d is not None and record.nominal_diameters_m and self._near(record.nominal_diameters_m, float(target_d), 0.0006):
                score += 0.10; reasons.append("diameter")
            if target_a is not None and record.angles_deg and self._near(record.angles_deg, float(target_a), 2.0):
                score += 0.05; reasons.append("angle")
            if target_connectors is not None and record.connector_count == int(target_connectors):
                score += 0.05; reasons.append("connector_count")
            if target_system and target_system in {s.casefold() for s in record.systems}:
                score += 0.05; reasons.append("system")
            if target_material and target_material in {m.casefold() for m in record.materials}:
                score += 0.05; reasons.append("material")
            if target_manufacturer and (record.manufacturer or "").casefold() == target_manufacturer:
                score += 0.05; reasons.append("manufacturer")
            matches.append(LibraryMatch(record=record.model_copy(update={"family_path": str(safe)}), score=min(1.0, score), reasons=reasons))

        if not matches:
            return None
        matches.sort(key=lambda m: (-m.score, m.record.manufacturer or "", m.record.family_name, m.record.type_name, m.record.id))
        return matches[0]

    def resolve_plan(self, plan: RevitBuildPlan) -> RevitBuildPlan:
        out = plan.model_copy(deep=True)
        unresolved = 0
        for operation in out.operations:
            if not operation.family_query:
                continue
            match = self.resolve(operation.family_query)
            if match is None:
                unresolved += 1
                out.diagnostics.append(RevitBuildDiagnostic(
                    severity="warning",
                    code="library_family_unresolved",
                    message=f"No local family matched operation {operation.id}",
                    cbim_ids=[operation.cbim_id] if operation.cbim_id else [],
                    data={"query": operation.family_query},
                ))
                continue
            operation.resolved_family = {
                "family_id": match.record.id,
                "family_path": match.record.family_path,
                "family_name": match.record.family_name,
                "type_name": match.record.type_name,
                "manufacturer": match.record.manufacturer,
                "connector_count": match.record.connector_count,
                "score": match.score,
                "match_reasons": match.reasons,
                "source": match.record.source,
                "redistribution": match.record.redistribution,
            }
        out.metadata["library_unresolved_count"] = unresolved
        out.metadata["library_resolved_count"] = sum(1 for op in out.operations if op.resolved_family)
        return out
