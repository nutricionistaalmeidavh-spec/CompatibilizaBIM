from __future__ import annotations

import math
from dataclasses import dataclass

from ..cad.model import CadDocument, CadEntity, CadLine, CadPoint


@dataclass(frozen=True)
class GeometryTolerance:
    distance: float = 1e-4
    angle_rad: float = 1e-6


def _q(value: float, tol: float) -> int:
    return round(value / tol)


def _point_key(point: CadPoint, tol: float) -> tuple[int, int, int]:
    return (_q(point.x, tol), _q(point.y, tol), _q(point.z, tol))


def _line_key(line: CadLine, tol: float):
    a, b = _point_key(line.start, tol), _point_key(line.end, tol)
    if b < a:
        a, b = b, a
    return (line.layer, a, b)


def remove_duplicate_lines(entities: list[CadEntity], *, tolerance: float = 1e-4) -> list[CadEntity]:
    seen = set()
    out: list[CadEntity] = []
    for entity in entities:
        if isinstance(entity, CadLine):
            key = _line_key(entity, tolerance)
            if key in seen:
                continue
            seen.add(key)
        out.append(entity)
    return out


def _near(a: CadPoint, b: CadPoint, tol: float) -> bool:
    return math.dist((a.x,a.y,a.z), (b.x,b.y,b.z)) <= tol


def _vector(a: CadPoint, b: CadPoint):
    return (b.x-a.x, b.y-a.y, b.z-a.z)


def _cross_norm(u, v) -> float:
    cx = u[1]*v[2]-u[2]*v[1]
    cy = u[2]*v[0]-u[0]*v[2]
    cz = u[0]*v[1]-u[1]*v[0]
    return math.sqrt(cx*cx+cy*cy+cz*cz)


def _collinear(a: CadLine, b: CadLine, tol: GeometryTolerance) -> bool:
    u = _vector(a.start, a.end)
    v = _vector(b.start, b.end)
    lu = math.sqrt(sum(x*x for x in u)); lv = math.sqrt(sum(x*x for x in v))
    if lu <= tol.distance or lv <= tol.distance:
        return False
    if _cross_norm(u, v)/(lu*lv) > tol.angle_rad:
        return False
    w = _vector(a.start, b.start)
    lw = math.sqrt(sum(x*x for x in w))
    return lw <= tol.distance or _cross_norm(u, w)/(lu*max(lw, tol.distance)) <= tol.angle_rad


def _merge_two(a: CadLine, b: CadLine, tol: GeometryTolerance) -> CadLine | None:
    if a.layer != b.layer or not _collinear(a, b, tol):
        return None
    # Require touching/overlap in 2D. Shapely projection is avoided here for deterministic pure math.
    u = _vector(a.start, a.end)
    length2 = sum(x*x for x in u)
    def t(p: CadPoint) -> float:
        w = _vector(a.start, p)
        return sum(w[i]*u[i] for i in range(3))/length2
    ta = [0.0, 1.0]
    tb = sorted([t(b.start), t(b.end)])
    margin = tol.distance / math.sqrt(length2)
    if tb[0] > 1 + margin or tb[1] < -margin:
        return None
    candidates = [(0.0,a.start),(1.0,a.end),(t(b.start),b.start),(t(b.end),b.end)]
    candidates.sort(key=lambda x: x[0])
    start, end = candidates[0][1], candidates[-1][1]
    return CadLine(id=min(a.id,b.id), layer=a.layer, start=start, end=end, metadata={**a.metadata, **b.metadata, "merged": True})


def _canonical_unit(line: CadLine, tol: GeometryTolerance) -> tuple[float,float,float] | None:
    u=_vector(line.start,line.end)
    length=math.sqrt(sum(x*x for x in u))
    if length <= tol.distance:
        return None
    u=tuple(x/length for x in u)
    # Canonical orientation makes reverse-drawn segments share a bucket.
    for value in u:
        if abs(value) > tol.angle_rad:
            if value < 0: u=tuple(-x for x in u)
            break
    return u


def _line_bucket(line: CadLine, tol: GeometryTolerance):
    """Approximate infinite-line bucket used to avoid all-pairs comparisons."""
    u=_canonical_unit(line,tol)
    if u is None: return None
    angle_q=max(tol.angle_rad,1e-7)
    dir_key=tuple(round(v/angle_q) for v in u)
    p=(line.start.x,line.start.y,line.start.z)
    dot=sum(p[i]*u[i] for i in range(3))
    perp=tuple(p[i]-dot*u[i] for i in range(3))
    support_key=tuple(round(v/max(tol.distance,1e-9)) for v in perp)
    return (line.layer,dir_key,support_key),u


def merge_collinear_lines(entities: list[CadEntity], *, tolerance: GeometryTolerance = GeometryTolerance()) -> list[CadEntity]:
    """Merge touching/overlapping collinear lines in roughly O(n log n).

    The previous implementation repeatedly compared every line against every other line,
    which becomes pathological on real DWGs. Lines are now bucketed by layer/direction/
    support line, projected to 1-D, sorted, and only adjacent intervals are considered.
    """
    others=[e for e in entities if not isinstance(e,CadLine)]
    buckets: dict[tuple,list[tuple[CadLine,tuple[float,float,float]]]]={}
    degenerate: list[CadLine]=[]
    for line in (e for e in entities if isinstance(e,CadLine)):
        bucket=_line_bucket(line,tolerance)
        if bucket is None:
            degenerate.append(line); continue
        key,u=bucket; buckets.setdefault(key,[]).append((line,u))
    out: list[CadLine]=[]
    for group in buckets.values():
        u=group[0][1]
        def proj(p: CadPoint)->float: return p.x*u[0]+p.y*u[1]+p.z*u[2]
        intervals=[]
        for line,_ in group:
            a,b=proj(line.start),proj(line.end)
            if a<=b: intervals.append((a,b,line.start,line.end,line))
            else: intervals.append((b,a,line.end,line.start,line))
        intervals.sort(key=lambda item:(item[0],item[1],item[4].id))
        cur_a,cur_b,cur_start,cur_end,cur_line=intervals[0]
        merged_ids=[cur_line.id]
        merged_meta=dict(cur_line.metadata)
        for a,b,start,end,line in intervals[1:]:
            if a <= cur_b + tolerance.distance:
                if b > cur_b:
                    cur_b,cur_end=b,end
                merged_ids.append(line.id); merged_meta.update(line.metadata)
            else:
                meta=dict(merged_meta)
                if len(merged_ids)>1:
                    meta.update({'merged':True,'merged_entity_count':len(merged_ids),'merged_entity_ids':','.join(sorted(merged_ids))})
                out.append(CadLine(id=min(merged_ids),layer=cur_line.layer,start=cur_start,end=cur_end,metadata=meta))
                cur_a,cur_b,cur_start,cur_end,cur_line=a,b,start,end,line
                merged_ids=[line.id]; merged_meta=dict(line.metadata)
        meta=dict(merged_meta)
        if len(merged_ids)>1:
            meta.update({'merged':True,'merged_entity_count':len(merged_ids),'merged_entity_ids':','.join(sorted(merged_ids))})
        out.append(CadLine(id=min(merged_ids),layer=cur_line.layer,start=cur_start,end=cur_end,metadata=meta))
    return [*out,*degenerate,*others]


class GeometryNormalizer:
    def __init__(self, tolerance: GeometryTolerance = GeometryTolerance()):
        self.tolerance = tolerance

    def normalize(self, document: CadDocument) -> CadDocument:
        entities = remove_duplicate_lines(document.entities, tolerance=self.tolerance.distance)
        entities = merge_collinear_lines(entities, tolerance=self.tolerance)
        entities = sorted(entities, key=lambda e: (e.layer, e.kind, e.id))
        return document.model_copy(update={"entities": entities, "layers": sorted({e.layer for e in entities}), "metadata": {**document.metadata, "geometry_normalized": True, "tolerance_m": self.tolerance.distance}})
