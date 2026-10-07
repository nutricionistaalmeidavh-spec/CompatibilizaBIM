from __future__ import annotations

import json
from pathlib import Path
from typing import TypeVar

from .models import (
    Building, CBIMElement, CBIMProject, Material, Relation, Site, Storey, System,
)

T = TypeVar("T")


class CBIMDocument:
    """Mutable façade over the versioned CBIM contract.

    Domain models remain strict Pydantic objects. The façade is the stable SDK seam
    used by Core, Revit adapters and future integrations.
    """

    def __init__(self, project: CBIMProject):
        self.project = project

    @classmethod
    def create(cls, name: str, **metadata) -> "CBIMDocument":
        return cls(CBIMProject(name=name, metadata=metadata))

    @classmethod
    def load(cls, path: str | Path) -> "CBIMDocument":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(CBIMProject.model_validate(data))

    def save(self, path: str | Path) -> Path:
        target = Path(path)
        target.write_text(
            self.project.model_dump_json(by_alias=True, exclude_computed_fields=True, indent=2),
            encoding="utf-8",
        )
        return target

    def _replace(self, **changes) -> None:
        self.project = self.project.model_copy(update=changes)
        # Re-validate cross references after each mutation.
        self.project = CBIMProject.model_validate(self.project.model_dump(by_alias=True, exclude_computed_fields=True))

    def add_site(self, site: Site) -> Site:
        self._replace(sites=[*self.project.sites, site])
        return site

    def add_building(self, building: Building) -> Building:
        self._replace(buildings=[*self.project.buildings, building])
        return building

    def add_storey(self, storey: Storey) -> Storey:
        self._replace(storeys=[*self.project.storeys, storey])
        return storey

    def add_material(self, material: Material) -> Material:
        self._replace(materials=[*self.project.materials, material])
        return material

    def add_system(self, system: System) -> System:
        self._replace(systems=[*self.project.systems, system])
        return system

    def add_element(self, element: CBIMElement) -> CBIMElement:
        self._replace(elements=[*self.project.elements, element])
        return element

    def add_relation(self, relation: Relation) -> Relation:
        self._replace(relations=[*self.project.relations, relation])
        return relation

    def get(self, cbim_id: str):
        if cbim_id == self.project.id:
            return self.project
        for collection in (
            self.project.sites, self.project.buildings, self.project.storeys,
            self.project.materials, self.project.systems, self.project.elements, self.project.relations,
        ):
            for item in collection:
                if item.id == cbim_id:
                    return item
        return None

    def query_elements(self, *, type: str | None = None, storey_id: str | None = None) -> list[CBIMElement]:
        result = list(self.project.elements)
        if type is not None:
            result = [e for e in result if e.type == type]
        if storey_id is not None:
            result = [e for e in result if e.storey_id == storey_id]
        return result

    def connect(self, a_id: str, b_id: str, **metadata) -> Relation:
        return self.add_relation(Relation(type="connects", from_id=a_id, to_id=b_id, metadata=metadata))

    def host(self, host_id: str, child_id: str, **metadata) -> Relation:
        return self.add_relation(Relation(type="host", from_id=host_id, to_id=child_id, metadata=metadata))

    def contains(self, container_id: str, child_id: str, **metadata) -> Relation:
        return self.add_relation(Relation(type="contains", from_id=container_id, to_id=child_id, metadata=metadata))

    def validate(self) -> CBIMProject:
        self.project = CBIMProject.model_validate(self.project.model_dump(by_alias=True, exclude_computed_fields=True))
        return self.project
