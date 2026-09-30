from __future__ import annotations

import math
from pydantic import BaseModel, ConfigDict, Field
from shapely.geometry import LineString, Polygon

from ..cad.model import CadArc, CadCircle, CadDocument, CadEntity, CadLine, CadPoint, CadPolyline, CadSpline


class AdvancedGeometryModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AdvancedGeometryConfig(AdvancedGeometryModel):
    chord_tolerance_m: float = Field(default=0.005, gt=0)
    max_segments_per_curve: int = Field(default=720, ge=8)
    min_segments_circle: int = Field(default=24, ge=8)
    angular_orthogonal_tolerance_deg: float = Field(default=1.0, ge=0, le=15)


class AdvancedGeometrySummary(AdvancedGeometryModel):
    entity_count: int
    arc_count: int = 0
    circle_count: int = 0
    spline_count: int = 0
    inclined_count: int = 0
    non_orthogonal_count: int = 0
    self_intersecting_polylines: list[str] = Field(default_factory=list)
    tessellated_segment_count: int = 0
    max_chord_error_m: float = 0.0


def _segments_for_arc(radius: float, sweep_rad: float, tolerance: float, max_segments: int, minimum: int = 2) -> int:
    if radius <= 0 or sweep_rad <= 0:
        return minimum
    if tolerance >= radius:
        n = minimum
    else:
        # sagitta <= tolerance => theta <= 2*acos(1-tol/r)
        max_theta = 2.0 * math.acos(max(-1.0, min(1.0, 1.0 - tolerance / radius)))
        n = math.ceil(sweep_rad / max(max_theta, 1e-9))
    return max(minimum, min(max_segments, n))


def _arc_points(entity: CadArc, cfg: AdvancedGeometryConfig) -> tuple[list[CadPoint], float]:
    start = entity.start_angle_deg
    end = entity.end_angle_deg
    while end <= start:
        end += 360.0
    sweep = math.radians(end - start)
    n = _segments_for_arc(entity.radius, sweep, cfg.chord_tolerance_m, cfg.max_segments_per_curve)
    pts = []
    for i in range(n + 1):
        angle = math.radians(start) + sweep * i / n
        pts.append(CadPoint(x=entity.center.x + entity.radius * math.cos(angle), y=entity.center.y + entity.radius * math.sin(angle), z=entity.center.z))
    theta = sweep / n
    error = entity.radius * (1.0 - math.cos(theta / 2.0))
    return pts, error


def _circle_points(entity: CadCircle, cfg: AdvancedGeometryConfig) -> tuple[list[CadPoint], float]:
    n = max(cfg.min_segments_circle, _segments_for_arc(entity.radius, math.tau, cfg.chord_tolerance_m, cfg.max_segments_per_curve, cfg.min_segments_circle))
    pts = [CadPoint(x=entity.center.x + entity.radius * math.cos(math.tau * i / n), y=entity.center.y + entity.radius * math.sin(math.tau * i / n), z=entity.center.z) for i in range(n)]
    pts.append(pts[0])
    error = entity.radius * (1.0 - math.cos(math.pi / n))
    return pts, error


def _spline_points(entity: CadSpline, cfg: AdvancedGeometryConfig) -> tuple[list[CadPoint], float]:
    # The canonical CAD model stores spline control/sample points but not knots/weights.
    # Densify its control polygon and explicitly retain approximation metadata.
    out: list[CadPoint] = []
    for a, b in zip(entity.points, entity.points[1:]):
        length = math.dist((a.x, a.y, a.z), (b.x, b.y, b.z))
        n = max(1, min(cfg.max_segments_per_curve, math.ceil(length / max(cfg.chord_tolerance_m * 4, 0.02))))
        for i in range(n):
            t = i / n
            out.append(CadPoint(x=a.x + (b.x-a.x)*t, y=a.y+(b.y-a.y)*t, z=a.z+(b.z-a.z)*t))
    out.append(entity.points[-1])
    if entity.closed and out and (out[0].x, out[0].y, out[0].z) != (out[-1].x, out[-1].y, out[-1].z):
        out.append(out[0])
    return out, cfg.chord_tolerance_m


class AdvancedGeometryEngine:
    """Preserve complex CAD geometry while providing CBIM-compatible segmentation.

    Curves remain traceable to their original CAD entity through metadata. Consumers
    that only support straight segments can use ``tessellate`` without losing source
    provenance or silently pretending the approximation is exact.
    """

    def __init__(self, config: AdvancedGeometryConfig | None = None):
        self.config = config or AdvancedGeometryConfig()

    def analyze(self, document: CadDocument) -> AdvancedGeometrySummary:
        arc_count = circle_count = spline_count = inclined = non_orthogonal = 0
        self_intersections: list[str] = []
        for e in document.entities:
            if isinstance(e, CadArc):
                arc_count += 1
            elif isinstance(e, CadCircle):
                circle_count += 1
            elif isinstance(e, CadSpline):
                spline_count += 1
            if isinstance(e, CadLine):
                dz = e.end.z - e.start.z
                if abs(dz) > 1e-9:
                    inclined += 1
                dx, dy = e.end.x-e.start.x, e.end.y-e.start.y
                if abs(dx) + abs(dy) > 1e-12:
                    angle = abs(math.degrees(math.atan2(dy, dx))) % 90.0
                    distance = min(angle, 90.0-angle)
                    if distance > self.config.angular_orthogonal_tolerance_deg:
                        non_orthogonal += 1
            if isinstance(e, CadPolyline) and e.closed and len(e.points) >= 4:
                coords = [(p.x, p.y) for p in e.points]
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                ring = LineString(coords)
                if not ring.is_simple or not Polygon(coords).is_valid:
                    self_intersections.append(e.id)
        tess = self.tessellate(document)
        max_error = max((float(e.metadata.get("approximation_error_m", 0.0)) for e in tess.entities), default=0.0)
        segment_count = sum(1 for e in tess.entities if isinstance(e, CadLine) and "source_entity_id" in e.metadata)
        return AdvancedGeometrySummary(
            entity_count=len(document.entities), arc_count=arc_count, circle_count=circle_count,
            spline_count=spline_count, inclined_count=inclined, non_orthogonal_count=non_orthogonal,
            self_intersecting_polylines=sorted(self_intersections), tessellated_segment_count=segment_count,
            max_chord_error_m=max_error,
        )

    def tessellate(self, document: CadDocument) -> CadDocument:
        entities: list[CadEntity] = []
        for e in document.entities:
            points: list[CadPoint] | None = None
            error = 0.0
            curve_kind = None
            closed = False
            if isinstance(e, CadArc):
                points, error, curve_kind = *_arc_points(e, self.config), "arc"
            elif isinstance(e, CadCircle):
                points, error, curve_kind, closed = *_circle_points(e, self.config), "circle", True
            elif isinstance(e, CadSpline):
                points, error, curve_kind, closed = *_spline_points(e, self.config), "spline", e.closed
            if points is None:
                entities.append(e)
                continue
            for i, (a, b) in enumerate(zip(points, points[1:])):
                if math.dist((a.x,a.y,a.z),(b.x,b.y,b.z)) <= 1e-12:
                    continue
                metadata = dict(e.metadata)
                metadata.update({
                    "source_entity_id": e.id,
                    "curve_kind": curve_kind,
                    "segment_index": i,
                    "approximation_error_m": float(error),
                    "curve_closed": closed,
                    "advanced_geometry": True,
                })
                if curve_kind == "spline":
                    metadata["spline_control_polygon_approximation"] = True
                entities.append(CadLine(id=f"{e.id}::seg{i:04d}", layer=e.layer, start=a, end=b, metadata=metadata))
        return document.model_copy(update={
            "entities": entities,
            "layers": sorted({e.layer for e in entities}),
            "metadata": {**document.metadata, "advanced_geometry_tessellated": True, "chord_tolerance_m": self.config.chord_tolerance_m},
        })
