from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import ezdxf
from ezdxf import path as ezpath, units

from .model import (
    CadArc, CadBlock, CadCircle, CadDocument, CadEntity, CadInsert, CadLine,
    CadPoint, CadPolyline, CadSpline, CadText,
)


def _entity_id(entity) -> str:
    handle = getattr(entity.dxf, "handle", None)
    return handle or f"generated-{uuid4().hex[:12]}"


class DXFImporter:
    """Import DXF into a format-neutral canonical CAD document in meters."""

    def __init__(self, *, unitless_scale_to_m: float = 1.0, curve_flattening_tolerance_m: float = 0.002):
        if unitless_scale_to_m <= 0:
            raise ValueError("unitless_scale_to_m must be positive")
        if curve_flattening_tolerance_m <= 0:
            raise ValueError("curve_flattening_tolerance_m must be positive")
        self.unitless_scale_to_m = unitless_scale_to_m
        self.curve_flattening_tolerance_m = curve_flattening_tolerance_m

    def read(self, path: str | Path) -> CadDocument:
        source = Path(path)
        doc = ezdxf.readfile(source)
        scale = self._scale_to_m(doc)
        entities = self._read_entities(doc.modelspace(), scale)
        blocks: dict[str, CadBlock] = {}
        for block in doc.blocks:
            name = str(block.name)
            if name.startswith("*"):
                continue
            base = getattr(block.block.dxf, "base_point", None)
            base_point = self._point(base, scale) if base is not None else CadPoint(x=0, y=0, z=0)
            blocks[name] = CadBlock(name=name, base_point=base_point, entities=self._read_entities(block, scale))

        layers = sorted({e.layer for e in entities} | {e.layer for b in blocks.values() for e in b.entities})
        return CadDocument(
            source_id=f"dxf:{source.name}:{uuid4().hex[:8]}",
            source_format="dxf",
            source_path=str(source),
            units="m",
            entities=entities,
            blocks=blocks,
            layers=layers,
            metadata={
                "dxf_version": str(doc.dxfversion),
                "original_insunits": int(doc.units),
                "scale_to_m": scale,
            },
        )

    def _read_entities(self, space, scale: float) -> list[CadEntity]:
        result: list[CadEntity] = []
        for entity in space:
            kind = entity.dxftype()
            layer = str(getattr(entity.dxf, "layer", "0"))
            eid = _entity_id(entity)
            if kind == "LINE":
                result.append(CadLine(id=eid, layer=layer, start=self._point(entity.dxf.start, scale), end=self._point(entity.dxf.end, scale)))
            elif kind in {"LWPOLYLINE", "POLYLINE"}:
                result.extend(self._polyline(entity, eid, layer, scale))
            elif kind == "ARC":
                result.append(CadArc(id=eid, layer=layer, center=self._point(entity.dxf.center, scale), radius=float(entity.dxf.radius) * scale, start_angle_deg=float(entity.dxf.start_angle), end_angle_deg=float(entity.dxf.end_angle)))
            elif kind == "CIRCLE":
                result.append(CadCircle(id=eid, layer=layer, center=self._point(entity.dxf.center, scale), radius=float(entity.dxf.radius) * scale))
            elif kind == "SPLINE":
                fit = list(entity.fit_points)
                control = list(entity.control_points)
                vectors = fit if len(fit) >= 2 else control
                if len(vectors) >= 2:
                    result.append(CadSpline(id=eid, layer=layer, points=[self._point(v, scale) for v in vectors], closed=bool(entity.closed)))
                else:
                    result.extend(self._flatten_curve(entity, eid, layer, scale))
            elif kind == "INSERT":
                result.append(CadInsert(
                    id=eid, layer=layer, block_name=str(entity.dxf.name), position=self._point(entity.dxf.insert, scale),
                    rotation_deg=float(getattr(entity.dxf, "rotation", 0.0) or 0.0),
                    xscale=float(getattr(entity.dxf, "xscale", 1.0) or 1.0),
                    yscale=float(getattr(entity.dxf, "yscale", 1.0) or 1.0),
                    zscale=float(getattr(entity.dxf, "zscale", 1.0) or 1.0),
                ))
            elif kind == "TEXT":
                result.append(CadText(id=eid, layer=layer, text=str(entity.dxf.text), position=self._point(entity.dxf.insert, scale), height=float(getattr(entity.dxf, "height", 0.0) or 0.0) * scale or None, rotation_deg=float(getattr(entity.dxf, "rotation", 0.0) or 0.0)))
            elif kind == "MTEXT":
                result.append(CadText(id=eid, layer=layer, text=entity.plain_text(), position=self._point(entity.dxf.insert, scale), height=float(getattr(entity.dxf, "char_height", 0.0) or 0.0) * scale or None, rotation_deg=0.0))
        return result

    def _polyline(self, entity, eid: str, layer: str, scale: float) -> list[CadEntity]:
        # Bulged LWPOLYLINE segments are flattened so curved geometry is not silently lost.
        if entity.dxftype() == "LWPOLYLINE":
            raw = list(entity.get_points("xyb"))
            has_bulge = any(abs(float(b)) > 1e-12 for _, _, b in raw)
            if has_bulge:
                return self._flatten_curve(entity, eid, layer, scale)
            points = [CadPoint(x=float(x) * scale, y=float(y) * scale) for x, y, _ in raw]
            closed = bool(entity.closed)
        else:
            points = [self._point(v.dxf.location, scale) for v in entity.vertices]
            closed = bool(entity.is_closed)
        return [CadPolyline(id=eid, layer=layer, points=points, closed=closed)] if len(points) >= 2 else []

    def _flatten_curve(self, entity, eid: str, layer: str, scale: float) -> list[CadEntity]:
        try:
            path = ezpath.make_path(entity)
            # ezdxf tolerance is in source drawing units.
            distance = self.curve_flattening_tolerance_m / scale
            vertices = list(path.flattening(distance=max(distance, 1e-9)))
            points = [self._point(v, scale) for v in vertices]
            if len(points) >= 2:
                return [CadPolyline(id=eid, layer=layer, points=points, closed=bool(getattr(entity, "closed", False)), metadata={"flattened_from": entity.dxftype()})]
        except Exception:
            pass
        return []

    def _scale_to_m(self, doc) -> float:
        source_units = int(doc.units)
        if source_units == 0:
            return self.unitless_scale_to_m
        try:
            return float(units.conversion_factor(source_units, units.M))
        except (ValueError, TypeError, ZeroDivisionError):
            return self.unitless_scale_to_m

    @staticmethod
    def _point(vector, scale: float) -> CadPoint:
        return CadPoint(x=float(vector.x) * scale, y=float(vector.y) * scale, z=float(vector.z) * scale)
