from __future__ import annotations

import csv
import json
import math
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence


@dataclass(frozen=True, slots=True)
class QuantityRecord:
    source_file: str
    discipline: str
    global_id: str
    ifc_class: str
    element_name: str | None
    type_name: str | None
    storey: str | None
    material: str | None
    quantity_name: str
    kind: str
    value: float
    unit: str
    source: str


@dataclass(frozen=True, slots=True)
class QuantityGroup:
    discipline: str
    source: str
    storey: str | None
    ifc_class: str
    type_name: str | None
    material: str | None
    quantity_name: str
    kind: str
    unit: str
    value: float
    element_count: int


_KIND_META = {
    "IfcQuantityLength": ("length", "LengthValue", "m", 1),
    "IfcQuantityArea": ("area", "AreaValue", "m2", 2),
    "IfcQuantityVolume": ("volume", "VolumeValue", "m3", 3),
    "IfcQuantityCount": ("count", "CountValue", "un", 0),
    "IfcQuantityWeight": ("weight", "WeightValue", "kg", 0),
}


def extract_element_quantities(
    element: Any,
    *,
    source_file: str,
    discipline: str,
    unit_scale_m: float = 1.0,
) -> list[QuantityRecord]:
    records: list[QuantityRecord] = []
    seen: set[tuple[str, str]] = set()
    global_id = str(getattr(element, "GlobalId", "") or "")
    ifc_class = str(element.is_a()) if hasattr(element, "is_a") else type(element).__name__
    element_name = _text(getattr(element, "Name", None))
    type_name = _element_type_name(element)
    storey = _element_storey(element)
    material = _element_material_name(element)

    for qset in _element_quantity_sets(element):
        for quantity in getattr(qset, "Quantities", ()) or ():
            qclass = str(quantity.is_a()) if hasattr(quantity, "is_a") else type(quantity).__name__
            meta = _KIND_META.get(qclass)
            if meta is None:
                continue
            kind, attr, unit, power = meta
            raw = getattr(quantity, attr, None)
            if raw is None:
                continue
            name = str(getattr(quantity, "Name", None) or kind)
            key = (name.casefold(), kind)
            if key in seen:
                continue
            value = float(raw)
            if power:
                value *= float(unit_scale_m) ** power
            if not math.isfinite(value) or value < 0:
                continue
            seen.add(key)
            records.append(
                QuantityRecord(
                    source_file=source_file,
                    discipline=discipline,
                    global_id=global_id,
                    ifc_class=ifc_class,
                    element_name=element_name,
                    type_name=type_name,
                    storey=storey,
                    material=material,
                    quantity_name=name,
                    kind=kind,
                    value=value,
                    unit=unit,
                    source="ifc_qto",
                )
            )
    return records


def geometry_fallback_records(mesh: dict[str, Any]) -> list[QuantityRecord]:
    vertices = tuple(float(v) for v in mesh.get("vertices", ()))
    triangles = tuple(int(v) for v in mesh.get("triangles", ()))
    if len(vertices) < 9 or len(triangles) < 3:
        return []
    area = 0.0
    signed_volume = 0.0
    for i in range(0, len(triangles) - 2, 3):
        try:
            a = _vertex(vertices, triangles[i])
            b = _vertex(vertices, triangles[i + 1])
            c = _vertex(vertices, triangles[i + 2])
        except IndexError:
            continue
        ab = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        ac = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
        cross = (
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        )
        area += 0.5 * math.sqrt(sum(v * v for v in cross))
        signed_volume += (
            a[0] * (b[1] * c[2] - b[2] * c[1])
            - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0])
        ) / 6.0
    base = dict(
        source_file=str(mesh.get("source_file") or ""),
        discipline=str(mesh.get("discipline") or "Unknown"),
        global_id=str(mesh.get("global_id") or ""),
        ifc_class=str(mesh.get("ifc_class") or "IfcProduct"),
        element_name=_text(mesh.get("name")),
        type_name=_text(mesh.get("type_name")),
        storey=_text(mesh.get("storey")),
        material=_text(mesh.get("material")),
        source="geometry_fallback",
    )
    rows: list[QuantityRecord] = []
    if area > 0:
        rows.append(QuantityRecord(**base, quantity_name="SurfaceArea", kind="area", value=area, unit="m2"))
    volume = abs(signed_volume)
    if volume > 1e-9:
        rows.append(QuantityRecord(**base, quantity_name="MeshVolume", kind="volume", value=volume, unit="m3"))
    return rows


def summarize_quantities(records: Sequence[QuantityRecord]) -> tuple[QuantityGroup, ...]:
    totals: dict[tuple, float] = {}
    elements: dict[tuple, set[str]] = {}
    order: list[tuple] = []
    for row in records:
        key = (
            row.discipline, row.source, row.storey, row.ifc_class, row.type_name, row.material,
            row.quantity_name, row.kind, row.unit,
        )
        if key not in totals:
            totals[key] = 0.0
            elements[key] = set()
            order.append(key)
        totals[key] += row.value
        elements[key].add(row.global_id or f"{row.source_file}:{row.element_name}:{len(elements[key])}")
    return tuple(
        QuantityGroup(
            discipline=k[0], source=k[1], storey=k[2], ifc_class=k[3], type_name=k[4], material=k[5],
            quantity_name=k[6], kind=k[7], unit=k[8], value=totals[k], element_count=len(elements[k]),
        ) for k in order
    )


def quantity_report(records: Sequence[QuantityRecord], *, model_files: Sequence[str]) -> dict[str, Any]:
    groups = summarize_quantities(records)
    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "models": list(model_files),
        "record_count": len(records),
        "group_count": len(groups),
        "records": [_record_json(row) for row in records],
        "groups": [asdict(group) for group in groups],
    }


def write_quantity_json(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def write_quantity_csv(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = ["discipline", "source", "storey", "ifc_class", "type_name", "material", "quantity_name", "kind", "unit", "value", "element_count"]
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in report.get("groups", []):
            writer.writerow({field: row.get(field) for field in fields})


def _record_json(row: QuantityRecord) -> dict[str, Any]:
    return asdict(row)


def _element_quantity_sets(element: Any) -> Iterable[Any]:
    for rel in getattr(element, "IsDefinedBy", ()) or ():
        pdef = getattr(rel, "RelatingPropertyDefinition", None)
        if pdef is not None and _is_a(pdef, "IfcElementQuantity"):
            yield pdef
    for rel in getattr(element, "IsTypedBy", ()) or ():
        typ = getattr(rel, "RelatingType", None)
        for pset in getattr(typ, "HasPropertySets", ()) or () if typ is not None else ():
            if _is_a(pset, "IfcElementQuantity"):
                yield pset


def _element_type_name(element: Any) -> str | None:
    for rel in getattr(element, "IsTypedBy", ()) or ():
        typ = getattr(rel, "RelatingType", None)
        if typ is not None:
            return _text(getattr(typ, "Name", None))
    return None


def _element_storey(element: Any) -> str | None:
    for rel in getattr(element, "ContainedInStructure", ()) or ():
        structure = getattr(rel, "RelatingStructure", None)
        if structure is not None and _is_a(structure, "IfcBuildingStorey"):
            return _text(getattr(structure, "Name", None))
    return None


def _element_material_name(element: Any) -> str | None:
    for rel in getattr(element, "HasAssociations", ()) or ():
        material = getattr(rel, "RelatingMaterial", None)
        if material is None:
            continue
        name = _text(getattr(material, "Name", None))
        if name:
            return name
        for attr in ("Materials", "MaterialLayers", "MaterialProfiles"):
            values = getattr(material, attr, None) or ()
            names = [_text(getattr(v, "Name", None) or getattr(getattr(v, "Material", None), "Name", None)) for v in values]
            names = [n for n in names if n]
            if names:
                return ", ".join(names)
    return None


def _is_a(obj: Any, name: str) -> bool:
    try:
        result = obj.is_a()
    except Exception:
        return False
    return str(result) == name


def _vertex(vertices: Sequence[float], index: int) -> tuple[float, float, float]:
    start = index * 3
    return (vertices[start], vertices[start + 1], vertices[start + 2])


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None

class QuantityBackend:
    def open_model(self, path: Path) -> Any: ...
    def iter_elements(self, model: Any) -> Sequence[Any]: ...
    def quantity_unit_scale(self, model: Any) -> float: ...
    def extract_meshes(self, model: Any, path: Path, discipline: str, *, max_elements: int | None = None) -> Sequence[dict[str, Any]]: ...


class QuantityEngine:
    def __init__(self, backend: Any) -> None:
        self.backend = backend

    def extract(self, files: Sequence[Path], *, geometry_fallback: bool = True) -> list[QuantityRecord]:
        from .preflight import infer_discipline
        if not files:
            raise ValueError("Informe pelo menos um arquivo IFC")
        records: list[QuantityRecord] = []
        for path in files:
            model = self.backend.open_model(path)
            discipline = infer_discipline(path, {})
            scale = float(self.backend.quantity_unit_scale(model))
            file_rows: list[QuantityRecord] = []
            for element in self.backend.iter_elements(model):
                file_rows.extend(
                    extract_element_quantities(
                        element, source_file=path.name, discipline=discipline, unit_scale_m=scale
                    )
                )
            records.extend(file_rows)
            if geometry_fallback:
                existing: dict[str, set[str]] = {}
                for row in file_rows:
                    existing.setdefault(row.global_id, set()).add(row.kind)
                for mesh in self.backend.extract_meshes(model, path, discipline, max_elements=None):
                    for fallback in geometry_fallback_records(mesh):
                        if fallback.kind not in existing.get(fallback.global_id, set()):
                            records.append(fallback)
        return records
