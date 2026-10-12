from pathlib import Path

from compatibilizabim.preflight import (
    BoundingBox,
    ModelPreflight,
    PreflightEngine,
    analyze_federation,
    infer_discipline,
)


class FakePreflightBackend:
    def __init__(self, descriptions):
        self.descriptions = descriptions
        self.opened: list[str] = []

    def open_model(self, path: Path):
        self.opened.append(path.name)
        return {"name": path.name}

    def inspect_model(self, model, path: Path):
        return self.descriptions[path.name]


def _report(path: Path, *, bbox: BoundingBox, sha256: str, schema: str = "IFC4", unit_scale: float = 1.0):
    return ModelPreflight(
        path=path,
        sha256=sha256,
        schema=schema,
        unit_scale_m=unit_scale,
        element_count=100,
        geometry_count=90,
        storeys=("Level 1", "Level 2"),
        discipline="Unknown",
        bbox=bbox,
    )


def test_preflight_engine_combines_backend_metadata_with_file_hash_and_discipline(tmp_path):
    arc = tmp_path / "Projeto_ARC.ifc"
    mep = tmp_path / "Projeto_MEP.ifc"
    arc.write_text("architecture", encoding="utf-8")
    mep.write_text("mep", encoding="utf-8")

    backend = FakePreflightBackend(
        {
            arc.name: {
                "schema": "IFC4",
                "unit_scale_m": 1.0,
                "element_count": 120,
                "geometry_count": 110,
                "storeys": ("Térreo", "Pavimento 1"),
                "bbox": BoundingBox((0.0, 0.0, 0.0), (20.0, 10.0, 6.0)),
                "class_counts": {"IfcWall": 40, "IfcDoor": 20},
            },
            mep.name: {
                "schema": "IFC4",
                "unit_scale_m": 1.0,
                "element_count": 80,
                "geometry_count": 70,
                "storeys": ("Térreo", "Pavimento 1"),
                "bbox": BoundingBox((0.5, 0.5, 0.0), (19.0, 9.5, 6.0)),
                "class_counts": {"IfcPipeSegment": 30, "IfcDuctSegment": 20},
            },
        }
    )

    result = PreflightEngine(backend).run([arc, mep], alignment_tolerance_m=5.0)

    assert [model.path.name for model in result.models] == [arc.name, mep.name]
    assert result.models[0].sha256 != result.models[1].sha256
    assert result.models[0].discipline == "Architecture"
    assert result.models[1].discipline == "MEP"
    assert result.models[0].element_count == 120
    assert result.models[0].bbox.center == (10.0, 5.0, 3.0)
    assert result.aligned is True
    assert result.warnings == ()


def test_federation_warns_for_duplicate_schema_unit_and_spatial_misalignment(tmp_path):
    a = _report(
        tmp_path / "a.ifc",
        bbox=BoundingBox((0.0, 0.0, 0.0), (10.0, 10.0, 5.0)),
        sha256="same",
        schema="IFC4",
        unit_scale=1.0,
    )
    b = _report(
        tmp_path / "b.ifc",
        bbox=BoundingBox((100.0, 100.0, 0.0), (110.0, 110.0, 5.0)),
        sha256="same",
        schema="IFC2X3",
        unit_scale=0.001,
    )

    federation = analyze_federation((a, b), alignment_tolerance_m=5.0)

    codes = {warning.code for warning in federation.warnings}
    assert {"duplicate_file", "schema_mismatch", "unit_mismatch", "possible_misalignment"} <= codes
    assert federation.aligned is False


def test_infer_discipline_prefers_filename_then_class_evidence():
    assert infer_discipline(Path("modelo_STR.ifc"), {}) == "Structure"
    assert infer_discipline(Path("modelo.ifc"), {"IfcPipeSegment": 4}) == "MEP"
    assert infer_discipline(Path("modelo.ifc"), {"IfcWall": 4, "IfcDoor": 2}) == "Architecture"
    assert infer_discipline(Path("modelo.ifc"), {}) == "Unknown"
