from __future__ import annotations

from ..cad.model import CadDocument
from .analysis import closed_contours, intersections
from .blocks import expand_blocks
from .normalize import GeometryNormalizer, GeometryTolerance
from .spatial import SpatialIndex


class GeometryEngine:
    def __init__(self, *, tolerance_m: float = 1e-4):
        self.tolerance = GeometryTolerance(distance=tolerance_m)
        self.normalizer = GeometryNormalizer(self.tolerance)

    def process(self, document: CadDocument, *, expand_inserts: bool = True) -> CadDocument:
        current = expand_blocks(document) if expand_inserts else document
        return self.normalizer.normalize(current)

    def spatial_index(self, document: CadDocument) -> SpatialIndex:
        return SpatialIndex(document.entities)

    def intersections(self, document: CadDocument):
        return intersections(document.entities)

    def contours(self, document: CadDocument):
        return closed_contours(document.entities)
