from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class RevitModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, serialize_by_alias=True)


class RevitBuildOperation(RevitModel):
    id: str
    cbim_id: str | None = None
    action: Literal[
        "ensure_level",
        "create_wall",
        "create_floor",
        "create_pipe",
        "create_fitting",
        "place_family_instance",
        "create_stair_candidate",
        "create_column",
        "create_beam",
        "create_opening",
        "create_space",
        "review_only",
    ]
    category: str
    storey_id: str | None = None
    level_name: str | None = None
    dependencies: list[str] = Field(default_factory=list)
    geometry: dict[str, Any] = Field(default_factory=dict)
    parameters: dict[str, Any] = Field(default_factory=dict)
    family_query: dict[str, Any] | None = None
    resolved_family: dict[str, Any] | None = None
    source_refs: list[dict[str, Any]] = Field(default_factory=list)


class RevitBuildDiagnostic(RevitModel):
    severity: Literal["info", "warning", "error"] = "info"
    code: str
    message: str
    cbim_ids: list[str] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)


class RevitBuildPlan(RevitModel):
    schema_name: Literal["CBIM.RevitBuildPlan"] = Field(default="CBIM.RevitBuildPlan", alias="schema", serialization_alias="schema")

    @property
    def schema(self) -> str:
        return self.schema_name
    version: str = "1.0.0"
    revit_version: int = 2027
    project_id: str
    project_name: str
    units: Literal["m"] = "m"
    coordinate_reference: str = "local"
    operations: list[RevitBuildOperation] = Field(default_factory=list)
    diagnostics: list[RevitBuildDiagnostic] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
