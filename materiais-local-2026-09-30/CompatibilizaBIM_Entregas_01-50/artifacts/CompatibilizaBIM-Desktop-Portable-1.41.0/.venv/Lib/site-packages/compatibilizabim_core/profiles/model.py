from __future__ import annotations

import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..cad.model import CadDocument

MatchKind = Literal["exact", "contains", "regex"]
TargetKind = Literal["wall", "column", "beam", "slab", "door", "window", "space", "pipe", "fitting", "equipment", "ignore", "unknown"]

class ProfileModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class CadRule(ProfileModel):
    id: str
    target: TargetKind
    layer: str | None = None
    block: str | None = None
    match: MatchKind = "contains"
    system: str | None = None
    defaults: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
    priority: int = 0

    @model_validator(mode="after")
    def has_selector(self) -> "CadRule":
        if not self.layer and not self.block:
            raise ValueError("CAD rule requires layer or block selector")
        return self

    def matches(self, *, layer: str, block: str | None = None) -> bool:
        def one(pattern: str | None, value: str | None) -> bool:
            if pattern is None:
                return True
            if value is None:
                return False
            p, v = pattern.upper(), value.upper()
            if self.match == "exact": return v == p
            if self.match == "contains": return p in v
            return re.search(pattern, value, re.IGNORECASE) is not None
        return one(self.layer, layer) and one(self.block, block)

class CadProfile(ProfileModel):
    name: str
    version: str = "1.0"
    organization: str | None = None
    rules: list[CadRule] = Field(default_factory=list)

    def classify(self, *, layer: str, block: str | None = None) -> CadRule | None:
        matches = [r for r in self.rules if r.matches(layer=layer, block=block)]
        return max(matches, key=lambda r: r.priority) if matches else None

    def save(self, path: str | Path) -> None:
        Path(path).write_text(self.model_dump_json(indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "CadProfile":
        return cls.model_validate_json(Path(path).read_text(encoding="utf-8"))

class CadProfileEngine:
    """Apply office/project CAD conventions without changing canonical geometry."""
    def apply(self, document: CadDocument, profile: CadProfile) -> CadDocument:
        data = document.model_dump()
        entities = []
        for entity in document.entities:
            raw = entity.model_dump()
            block = getattr(entity, "block_name", None)
            rule = profile.classify(layer=entity.layer, block=block)
            metadata = dict(entity.metadata)
            if rule:
                metadata.update({"profile": profile.name, "profile_rule": rule.id, "semantic_target": rule.target})
                if rule.system: metadata["semantic_system"] = rule.system
                for key, value in rule.defaults.items(): metadata[f"default_{key}"] = value
            raw["metadata"] = metadata
            entities.append(raw)
        data["entities"] = entities
        metadata = dict(document.metadata)
        metadata["cad_profile"] = profile.name
        metadata["cad_profile_version"] = profile.version
        data["metadata"] = metadata
        return CadDocument.model_validate(data)
