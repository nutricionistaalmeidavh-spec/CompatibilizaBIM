from __future__ import annotations

from pathlib import Path
from typing import Any, Sequence

from .preflight import BoundingBox


class IfcOpenShellUnavailable(RuntimeError):
    """Raised when the optional native IFC dependency is not installed."""


class IfcOpenShellBackend:
    def __init__(self) -> None:
        self._ifcopenshell = None
        self._geom = None
        self._unit = None

    def _load(self) -> tuple[Any, Any]:
        if self._ifcopenshell is not None and self._geom is not None:
            return self._ifcopenshell, self._geom
        try:
            import ifcopenshell  # type: ignore[import-not-found]
            import ifcopenshell.geom as geom  # type: ignore[import-not-found]
        except ImportError as exc:
            raise IfcOpenShellUnavailable(
                "IfcOpenShell não está instalado. Execute: pip install ifcopenshell==0.8.5"
            ) from exc
        self._ifcopenshell = ifcopenshell
        self._geom = geom
        return ifcopenshell, geom


    def _load_unit(self) -> Any:
        if self._unit is not None:
            return self._unit
        try:
            import ifcopenshell.util.unit as unit  # type: ignore[import-not-found]
        except ImportError as exc:
            raise IfcOpenShellUnavailable(
                "IfcOpenShell não está instalado. Execute: pip install ifcopenshell==0.8.5"
            ) from exc
        self._unit = unit
        return unit

    def inspect_model(self, model: Any, path: Path) -> dict[str, Any]:
        _, geom = self._load()
        unit = self._load_unit()

        class_names = (
            "IfcWall",
            "IfcDoor",
            "IfcWindow",
            "IfcRoof",
            "IfcStair",
            "IfcBeam",
            "IfcColumn",
            "IfcFooting",
            "IfcMember",
            "IfcPipeSegment",
            "IfcPipeFitting",
            "IfcDuctSegment",
            "IfcDuctFitting",
            "IfcCableCarrierSegment",
            "IfcCableSegment",
        )
        class_counts = {name: len(model.by_type(name)) for name in class_names}
        storeys = tuple(
            str(getattr(storey, "Name", None) or f"Storey #{storey.id()}")
            for storey in model.by_type("IfcBuildingStorey")
        )

        settings = geom.settings()
        settings.set("use-world-coords", True)
        iterator = geom.iterator(settings, model, num_threads=1)
        minimum = [float("inf"), float("inf"), float("inf")]
        maximum = [float("-inf"), float("-inf"), float("-inf")]
        geometry_count = 0

        if iterator.initialize():
            while True:
                shape = iterator.get()
                verts = tuple(float(value) for value in shape.geometry.verts)
                for index in range(0, len(verts) - 2, 3):
                    for axis in range(3):
                        value = verts[index + axis]
                        minimum[axis] = min(minimum[axis], value)
                        maximum[axis] = max(maximum[axis], value)
                geometry_count += 1
                if not iterator.next():
                    break

        bbox = None
        if geometry_count > 0 and all(value != float("inf") for value in minimum):
            bbox = BoundingBox(tuple(minimum), tuple(maximum))

        return {
            "schema": str(getattr(model, "schema", "Unknown")),
            "unit_scale_m": float(unit.calculate_unit_scale(model)),
            "element_count": len(model.by_type("IfcElement")),
            "geometry_count": geometry_count,
            "storeys": storeys,
            "bbox": bbox,
            "class_counts": class_counts,
            "path": path,
        }


    def extract_meshes(
        self,
        model: Any,
        path: Path,
        discipline: str,
        *,
        max_elements: int | None = None,
    ) -> list[dict[str, Any]]:
        _, geom = self._load()
        settings = geom.settings()
        settings.set("use-world-coords", True)
        iterator = geom.iterator(settings, model, num_threads=1)
        meshes: list[dict[str, Any]] = []

        if not iterator.initialize():
            return meshes

        while True:
            shape = iterator.get()
            geometry = shape.geometry
            verts = tuple(float(value) for value in getattr(geometry, "verts", ()))
            faces = tuple(int(value) for value in getattr(geometry, "faces", ()))
            if verts and faces:
                product = None
                guid = str(getattr(shape, "guid", "") or "")
                if guid and hasattr(model, "by_guid"):
                    try:
                        product = model.by_guid(guid)
                    except Exception:
                        product = None
                if product is None and hasattr(shape, "id") and hasattr(model, "by_id"):
                    try:
                        product = model.by_id(int(shape.id))
                    except Exception:
                        product = None

                if product is not None:
                    global_id = str(getattr(product, "GlobalId", None) or guid)
                    ifc_class = str(product.is_a())
                    name = getattr(product, "Name", None)
                else:
                    global_id = guid
                    ifc_class = "IfcProduct"
                    name = None

                meshes.append(
                    {
                        "global_id": global_id,
                        "ifc_class": ifc_class,
                        "name": name,
                        "discipline": discipline,
                        "source_file": path.name,
                        "vertices": verts,
                        "triangles": faces,
                    }
                )
                if max_elements is not None and len(meshes) >= max_elements:
                    break
            if not iterator.next():
                break

        return meshes


    def iter_elements(self, model: Any) -> Sequence[Any]:
        return model.by_type("IfcElement")

    def quantity_unit_scale(self, model: Any) -> float:
        return float(self._load_unit().calculate_unit_scale(model))

    def open_model(self, path: Path) -> Any:
        ifcopenshell, _ = self._load()
        return ifcopenshell.open(str(path))

    def select_elements(self, model: Any, ifc_class: str) -> Sequence[Any]:
        return model.by_type(ifc_class)

    def build_tree(self, models: Sequence[Any]) -> Any:
        _, geom = self._load()
        settings = geom.settings()
        tree = geom.tree()
        for model in models:
            tree.add_file(model, settings)
        return tree

    def find_clashes(
        self,
        tree: Any,
        group_a: Sequence[Any],
        group_b: Sequence[Any],
        mode: str,
        tolerance: float,
        clearance: float,
        check_all: bool,
    ) -> list[dict[str, Any]]:
        if mode == "intersection":
            clashes = tree.clash_intersection_many(
                group_a, group_b, tolerance=tolerance, check_all=check_all
            )
        elif mode == "collision":
            clashes = tree.clash_collision_many(group_a, group_b, allow_touching=False)
        elif mode == "clearance":
            clashes = tree.clash_clearance_many(
                group_a, group_b, clearance=clearance, check_all=check_all
            )
        else:
            raise ValueError(f"Unsupported clash mode: {mode}")
        return [self.normalize_native_clash(clash) for clash in clashes]

    @staticmethod
    def normalize_native_clash(clash: Any) -> dict[str, Any]:
        names = ("protrusion", "pierce", "collision", "clearance")
        clash_type_index = int(getattr(clash, "clash_type", 2))
        clash_type = (
            names[clash_type_index]
            if 0 <= clash_type_index < len(names)
            else f"type_{clash_type_index}"
        )
        a = clash.a
        b = clash.b
        return {
            "a_global_id": str(a.get_argument(0) or ""),
            "b_global_id": str(b.get_argument(0) or ""),
            "a_ifc_class": str(a.is_a()),
            "b_ifc_class": str(b.is_a()),
            "a_name": a.get_argument(2),
            "b_name": b.get_argument(2),
            "clash_type": clash_type,
            "p1": [float(v) for v in clash.p1],
            "p2": [float(v) for v in clash.p2],
            "distance": float(getattr(clash, "distance", 0.0) or 0.0),
        }
