from __future__ import annotations

import math

from shapely.geometry import LineString, Point

from ..cad.model import CadArc, CadCircle, CadEntity, CadLine, CadPolyline, CadSpline


def entity_geometry(entity: CadEntity, *, curve_segments: int = 48):
    if isinstance(entity, CadLine):
        return LineString([(entity.start.x, entity.start.y), (entity.end.x, entity.end.y)])
    if isinstance(entity, CadPolyline):
        coords = [(p.x, p.y) for p in entity.points]
        if entity.closed and coords[0] != coords[-1]:
            coords.append(coords[0])
        return LineString(coords)
    if isinstance(entity, CadArc):
        start = entity.start_angle_deg
        end = entity.end_angle_deg
        while end <= start:
            end += 360.0
        sweep = end - start
        count = max(4, int(curve_segments * sweep / 360.0))
        coords = []
        for i in range(count + 1):
            angle = math.radians(start + sweep * i / count)
            coords.append((entity.center.x + entity.radius * math.cos(angle), entity.center.y + entity.radius * math.sin(angle)))
        return LineString(coords)
    if isinstance(entity, CadCircle):
        return Point(entity.center.x, entity.center.y).buffer(entity.radius, quad_segs=max(4, curve_segments // 4)).boundary
    if isinstance(entity, CadSpline):
        coords = [(p.x, p.y) for p in entity.points]
        if entity.closed and coords[0] != coords[-1]:
            coords.append(coords[0])
        return LineString(coords)
    return None
