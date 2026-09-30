from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry.base import BaseGeometry
from shapely.strtree import STRtree

from ..cad.model import CadEntity
from .convert import entity_geometry


@dataclass(frozen=True)
class IndexedEntity:
    entity: CadEntity
    geometry: BaseGeometry


class SpatialIndex:
    def __init__(self, entities: list[CadEntity]):
        self.items = [IndexedEntity(e, g) for e in entities if (g := entity_geometry(e)) is not None and not g.is_empty]
        self._geometries = [item.geometry for item in self.items]
        self._tree = STRtree(self._geometries) if self._geometries else None

    def query(self, geometry: BaseGeometry, *, predicate: str | None = None) -> list[CadEntity]:
        if self._tree is None:
            return []
        indices = self._tree.query(geometry, predicate=predicate) if predicate else self._tree.query(geometry)
        return [self.items[int(i)].entity for i in indices]
