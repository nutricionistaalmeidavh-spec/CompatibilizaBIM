from pathlib import Path

import pytest

from compatibilizabim.selftest import run_synthetic_validation


class FakeBackend:
    def open_model(self, path: Path):
        return {"path": path}

    def select_elements(self, model, ifc_class: str):
        return [model]

    def build_tree(self, models):
        return tuple(models)

    def find_clashes(self, tree, group_a, group_b, mode, tolerance, clearance, check_all):
        target = group_b[0]["path"].name
        if "overlap" not in target:
            return []
        return [
            {
                "a_global_id": "A",
                "b_global_id": "B",
                "a_ifc_class": "IfcProxy",
                "b_ifc_class": "IfcProxy",
                "a_name": "Sphere A",
                "b_name": "Sphere B Overlap",
                "clash_type": "collision",
                "p1": [0.4, 0.0, 0.0],
                "p2": [0.2, 0.0, 0.0],
                "distance": 0.2,
            }
        ]


def test_synthetic_validation_requires_overlap_and_clear_case(tmp_path):
    sample_dir = tmp_path / "samples"
    sample_dir.mkdir()
    for name in ("sphere_a.ifc", "sphere_b_overlap.ifc", "sphere_b_clear.ifc"):
        (sample_dir / name).write_text("dummy", encoding="utf-8")

    result = run_synthetic_validation(FakeBackend(), sample_dir)

    assert result.overlap_count == 1
    assert result.clear_count == 0
    assert result.passed is True


def test_synthetic_validation_fails_if_overlap_is_not_detected(tmp_path):
    class NoClashBackend(FakeBackend):
        def find_clashes(self, *args, **kwargs):
            return []

    sample_dir = tmp_path / "samples"
    sample_dir.mkdir()
    for name in ("sphere_a.ifc", "sphere_b_overlap.ifc", "sphere_b_clear.ifc"):
        (sample_dir / name).write_text("dummy", encoding="utf-8")

    with pytest.raises(RuntimeError, match="sobreposição"):
        run_synthetic_validation(NoClashBackend(), sample_dir)
