from pathlib import Path

from compatibilizabim.engine import ClashEngine
from compatibilizabim.models import ClashRequest


class FakeBackend:
    def __init__(self):
        self.calls = []

    def open_model(self, path: Path):
        self.calls.append(("open_model", path.name))
        return {"path": path.name}

    def select_elements(self, model, ifc_class: str):
        self.calls.append(("select_elements", model["path"], ifc_class))
        return [f"{model['path']}::{ifc_class}"]

    def build_tree(self, models):
        self.calls.append(("build_tree", tuple(m["path"] for m in models)))
        return "tree"

    def find_clashes(self, tree, group_a, group_b, mode, tolerance, clearance, check_all):
        self.calls.append(("find_clashes", tree, mode, tolerance, clearance, check_all))
        return [
            {
                "a_global_id": "A1",
                "b_global_id": "B1",
                "a_ifc_class": "IfcPipeSegment",
                "b_ifc_class": "IfcBeam",
                "a_name": "Pipe 1",
                "b_name": "Beam 1",
                "clash_type": "pierce",
                "p1": [1.0, 2.0, 3.0],
                "p2": [1.0, 2.0, 3.08],
                "distance": 0.08,
            }
        ]


def test_engine_normalizes_backend_clash_and_keeps_request_metadata(tmp_path):
    a = tmp_path / "hydraulics.ifc"
    b = tmp_path / "structure.ifc"
    a.write_text("dummy")
    b.write_text("dummy")
    backend = FakeBackend()
    engine = ClashEngine(backend)

    request = ClashRequest(
        file_a=a,
        file_b=b,
        class_a="IfcPipeSegment",
        class_b="IfcBeam",
        mode="intersection",
        tolerance=0.002,
        clearance=0.05,
        check_all=True,
    )
    results = engine.run(request)

    assert len(results) == 1
    result = results[0]
    assert result.a_global_id == "A1"
    assert result.b_global_id == "B1"
    assert result.mode == "intersection"
    assert result.depth_m == 0.08
    assert result.point == (1.0, 2.0, 3.04)
    assert backend.calls[-1] == (
        "find_clashes",
        "tree",
        "intersection",
        0.002,
        0.05,
        True,
    )


def test_engine_returns_empty_list_when_backend_finds_no_clashes(tmp_path):
    class EmptyBackend(FakeBackend):
        def find_clashes(self, *args, **kwargs):
            return []

    a = tmp_path / "a.ifc"
    b = tmp_path / "b.ifc"
    a.write_text("dummy")
    b.write_text("dummy")

    results = ClashEngine(EmptyBackend()).run(ClashRequest(file_a=a, file_b=b))
    assert results == []
