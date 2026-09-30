from __future__ import annotations

import math
from dataclasses import replace

from ..cad.model import CadArc, CadCircle, CadDocument, CadEntity, CadInsert, CadLine, CadPoint, CadPolyline, CadSpline, CadText


def _transform_point(point: CadPoint, insert: CadInsert, base: CadPoint) -> CadPoint:
    x = (point.x - base.x) * insert.xscale
    y = (point.y - base.y) * insert.yscale
    z = (point.z - base.z) * insert.zscale
    angle = math.radians(insert.rotation_deg)
    xr = x * math.cos(angle) - y * math.sin(angle)
    yr = x * math.sin(angle) + y * math.cos(angle)
    return CadPoint(x=xr + insert.position.x, y=yr + insert.position.y, z=z + insert.position.z)


def _transform_entity(entity: CadEntity, insert: CadInsert, base: CadPoint, suffix: str) -> CadEntity:
    common = {"id": f"{insert.id}/{suffix}/{entity.id}", "layer": entity.layer if entity.layer != "0" else insert.layer, "metadata": {**entity.metadata, "expanded_from_block": insert.block_name}}
    if isinstance(entity, CadLine):
        return CadLine(**common, start=_transform_point(entity.start, insert, base), end=_transform_point(entity.end, insert, base))
    if isinstance(entity, CadPolyline):
        return CadPolyline(**common, points=[_transform_point(p, insert, base) for p in entity.points], closed=entity.closed)
    if isinstance(entity, CadSpline):
        return CadSpline(**common, points=[_transform_point(p, insert, base) for p in entity.points], closed=entity.closed)
    if isinstance(entity, CadText):
        return CadText(**common, text=entity.text, position=_transform_point(entity.position, insert, base), height=(entity.height * abs(insert.yscale) if entity.height else None), rotation_deg=entity.rotation_deg + insert.rotation_deg)
    if isinstance(entity, CadCircle):
        if abs(abs(insert.xscale) - abs(insert.yscale)) > 1e-9:
            # Preserve center, use mean scale, and flag approximation rather than silently claiming exactness.
            scale = (abs(insert.xscale) + abs(insert.yscale)) / 2
            return CadCircle(**common, center=_transform_point(entity.center, insert, base), radius=entity.radius*scale, metadata={**common["metadata"], "nonuniform_scale_approximation": True})
        return CadCircle(**common, center=_transform_point(entity.center, insert, base), radius=entity.radius*abs(insert.xscale))
    if isinstance(entity, CadArc):
        scale = (abs(insert.xscale) + abs(insert.yscale)) / 2
        meta = common["metadata"]
        if abs(abs(insert.xscale) - abs(insert.yscale)) > 1e-9:
            meta = {**meta, "nonuniform_scale_approximation": True}
        return CadArc(**{**common, "metadata": meta}, center=_transform_point(entity.center, insert, base), radius=entity.radius*scale, start_angle_deg=entity.start_angle_deg+insert.rotation_deg, end_angle_deg=entity.end_angle_deg+insert.rotation_deg)
    if isinstance(entity, CadInsert):
        # Nested insert receives composed placement approximately; recursive expansion handles child block.
        position = _transform_point(entity.position, insert, base)
        return CadInsert(**common, block_name=entity.block_name, position=position, rotation_deg=entity.rotation_deg+insert.rotation_deg, xscale=entity.xscale*insert.xscale, yscale=entity.yscale*insert.yscale, zscale=entity.zscale*insert.zscale)
    raise TypeError(type(entity))


def expand_blocks(document: CadDocument, *, max_depth: int = 16) -> CadDocument:
    out: list[CadEntity] = []

    def expand(entity: CadEntity, depth: int, stack: tuple[str, ...]):
        if not isinstance(entity, CadInsert):
            out.append(entity)
            return
        if depth > max_depth:
            raise ValueError(f"Block nesting exceeds max_depth={max_depth}")
        if entity.block_name in stack:
            raise ValueError(f"Recursive block reference detected: {' -> '.join((*stack, entity.block_name))}")
        block = document.blocks.get(entity.block_name)
        if block is None:
            out.append(entity)
            return
        for idx, child in enumerate(block.entities):
            transformed = _transform_entity(child, entity, block.base_point, str(idx))
            expand(transformed, depth+1, (*stack, entity.block_name))

    for entity in document.entities:
        expand(entity, 0, ())
    return document.model_copy(update={"entities": out, "layers": sorted({e.layer for e in out}), "metadata": {**document.metadata, "blocks_expanded": True}})
