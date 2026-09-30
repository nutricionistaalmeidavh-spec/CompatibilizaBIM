from __future__ import annotations

from itertools import combinations

from shapely.geometry import Point
from shapely.ops import polygonize, unary_union

from ..cad.model import CadEntity
from .convert import entity_geometry


def intersections(entities: list[CadEntity], *, tolerance: float = 1e-9) -> list[tuple[str, str, list[tuple[float, float]]]]:
    geoms = [(e, entity_geometry(e)) for e in entities]
    geoms = [(e,g) for e,g in geoms if g is not None and not g.is_empty]
    result = []
    for (a, ga), (b, gb) in combinations(geoms, 2):
        if not ga.intersects(gb):
            continue
        inter = ga.intersection(gb)
        pts: list[tuple[float,float]] = []
        if inter.geom_type == "Point":
            pts = [(float(inter.x), float(inter.y))]
        elif inter.geom_type == "MultiPoint":
            pts = [(float(p.x), float(p.y)) for p in inter.geoms]
        elif inter.geom_type in {"LineString", "MultiLineString"}:
            # Collinear overlap is represented by its boundary endpoints for topology consumers.
            boundary = inter.boundary
            if boundary.geom_type == "MultiPoint":
                pts = [(float(p.x), float(p.y)) for p in boundary.geoms]
        if pts:
            result.append((a.id, b.id, sorted(set(pts))))
    return result


def closed_contours(entities: list[CadEntity], *, min_area: float = 1e-8):
    lines = [g for e in entities if (g := entity_geometry(e)) is not None and g.geom_type in {"LineString", "LinearRing", "MultiLineString"}]
    if not lines:
        return []
    merged = unary_union(lines)
    polygons = [p for p in polygonize(merged) if p.area >= min_area]
    return sorted(polygons, key=lambda p: (round(p.area, 12), tuple(round(v, 12) for v in p.bounds)))
