from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any, Protocol, Sequence

from .preflight import BoundingBox, infer_discipline
from .rules import RuleClash


@dataclass(frozen=True, slots=True)
class MeshElement:
    global_id: str
    ifc_class: str
    name: str | None
    discipline: str
    source_file: str
    vertices: tuple[float, ...]
    triangles: tuple[int, ...]

    @property
    def bounds(self) -> BoundingBox:
        if len(self.vertices) < 3:
            return BoundingBox((0.0, 0.0, 0.0), (0.0, 0.0, 0.0))
        xs = self.vertices[0::3]
        ys = self.vertices[1::3]
        zs = self.vertices[2::3]
        return BoundingBox((min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs)))


@dataclass(frozen=True, slots=True)
class ViewerSession:
    elements: tuple[MeshElement, ...]
    clashes: tuple[RuleClash, ...]
    bounds: BoundingBox
    origin: tuple[float, float, float]

    @classmethod
    def from_elements(
        cls,
        elements: Sequence[MeshElement],
        *,
        clashes: Sequence[RuleClash] = (),
    ) -> "ViewerSession":
        items = tuple(elements)
        if not items:
            bounds = BoundingBox((0.0, 0.0, 0.0), (0.0, 0.0, 0.0))
        else:
            minima = [float("inf"), float("inf"), float("inf")]
            maxima = [float("-inf"), float("-inf"), float("-inf")]
            for element in items:
                bbox = element.bounds
                for axis in range(3):
                    minima[axis] = min(minima[axis], bbox.minimum[axis])
                    maxima[axis] = max(maxima[axis], bbox.maximum[axis])
            bounds = BoundingBox(tuple(minima), tuple(maxima))
        return cls(items, tuple(clashes), bounds, bounds.center)


class ViewerBackend(Protocol):
    def open_model(self, path: Path) -> Any: ...

    def extract_meshes(
        self,
        model: Any,
        path: Path,
        discipline: str,
        *,
        max_elements: int | None = None,
    ) -> Sequence[dict[str, Any]]: ...


class ViewerEngine:
    def __init__(self, backend: ViewerBackend) -> None:
        self.backend = backend

    def build(
        self,
        files: Sequence[Path],
        *,
        clashes: Sequence[RuleClash] = (),
        max_elements: int | None = None,
    ) -> ViewerSession:
        if not files:
            raise ValueError("Informe pelo menos um arquivo IFC")
        elements: list[MeshElement] = []
        for path in files:
            model = self.backend.open_model(path)
            discipline = infer_discipline(path, {})
            raw_meshes = self.backend.extract_meshes(
                model, path, discipline, max_elements=max_elements
            )
            for item in raw_meshes:
                elements.append(
                    MeshElement(
                        global_id=str(item.get("global_id") or ""),
                        ifc_class=str(item.get("ifc_class") or "IfcProduct"),
                        name=item.get("name"),
                        discipline=str(item.get("discipline") or discipline),
                        source_file=str(item.get("source_file") or path.name),
                        vertices=tuple(float(v) for v in item.get("vertices", ())),
                        triangles=tuple(int(v) for v in item.get("triangles", ())),
                    )
                )
        return ViewerSession.from_elements(elements, clashes=clashes)


def viewer_manifest(session: ViewerSession) -> dict[str, Any]:
    ox, oy, oz = session.origin
    elements = []
    for element in session.elements:
        relative: list[float] = []
        for index in range(0, len(element.vertices), 3):
            relative.extend(
                [
                    round(element.vertices[index] - ox, 6),
                    round(element.vertices[index + 1] - oy, 6),
                    round(element.vertices[index + 2] - oz, 6),
                ]
            )
        bbox = element.bounds
        elements.append(
            {
                "global_id": element.global_id,
                "ifc_class": element.ifc_class,
                "name": element.name,
                "discipline": element.discipline,
                "source_file": element.source_file,
                "vertices": relative,
                "triangles": list(element.triangles),
                "bounds": {
                    "minimum": [round(v - o, 6) for v, o in zip(bbox.minimum, session.origin, strict=True)],
                    "maximum": [round(v - o, 6) for v, o in zip(bbox.maximum, session.origin, strict=True)],
                },
            }
        )

    clashes = []
    for item in session.clashes:
        point = [
            round(item.clash.point[0] - ox, 6),
            round(item.clash.point[1] - oy, 6),
            round(item.clash.point[2] - oz, 6),
        ]
        clashes.append(
            {
                "rule_id": item.rule_id,
                "rule_name": item.rule_name,
                "severity": item.severity,
                "a_global_id": item.clash.a_global_id,
                "b_global_id": item.clash.b_global_id,
                "point": point,
                "depth_m": item.clash.depth_m,
            }
        )

    disciplines = sorted({element.discipline for element in session.elements})
    return {
        "version": 1,
        "origin": [round(v, 6) for v in session.origin],
        "bounds": {
            "minimum": [round(v - o, 6) for v, o in zip(session.bounds.minimum, session.origin, strict=True)],
            "maximum": [round(v - o, 6) for v, o in zip(session.bounds.maximum, session.origin, strict=True)],
        },
        "disciplines": disciplines,
        "elements": elements,
        "clashes": clashes,
    }


def load_rule_clashes(path: Path) -> tuple[RuleClash, ...]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("clashes")
    if not isinstance(rows, list):
        raise ValueError(f"Relatório de regras inválido: {path}")

    from .models import ClashResult

    items: list[RuleClash] = []
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError(f"Clash inválido no relatório: {path}")
        point_raw = row.get("point") or (0.0, 0.0, 0.0)
        point = tuple(float(value) for value in point_raw)
        if len(point) != 3:
            raise ValueError(f"Ponto de clash inválido no relatório: {path}")
        mode = str(row.get("mode") or "intersection")
        p1 = tuple(float(value) for value in (row.get("p1") or point))
        p2 = tuple(float(value) for value in (row.get("p2") or point))
        clash = ClashResult(
            index=int(row.get("index") or len(items) + 1),
            mode=mode,  # type: ignore[arg-type]
            a_global_id=str(row.get("a_global_id") or ""),
            b_global_id=str(row.get("b_global_id") or ""),
            a_ifc_class=str(row.get("a_ifc_class") or ""),
            b_ifc_class=str(row.get("b_ifc_class") or ""),
            a_name=row.get("a_name"),
            b_name=row.get("b_name"),
            clash_type=str(row.get("clash_type") or mode),
            p1=p1,  # type: ignore[arg-type]
            p2=p2,  # type: ignore[arg-type]
            point=point,  # type: ignore[arg-type]
            depth_m=float(row.get("depth_m") or 0.0),
        )
        items.append(
            RuleClash(
                rule_id=str(row.get("rule_id") or f"rule-{len(items) + 1}"),
                rule_name=str(row.get("rule_name") or "Clash"),
                severity=str(row.get("severity") or "high"),  # type: ignore[arg-type]
                clash=clash,
            )
        )
    return tuple(items)
