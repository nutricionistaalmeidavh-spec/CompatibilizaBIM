import importlib.util
import os
from pathlib import Path

import pytest

from compatibilizabim.engine import ClashEngine
from compatibilizabim.ifc_backend import IfcOpenShellBackend
from compatibilizabim.models import ClashRequest
from compatibilizabim.selftest import run_synthetic_validation


@pytest.mark.skipif(
    importlib.util.find_spec("ifcopenshell") is None,
    reason="IfcOpenShell não está instalado neste ambiente",
)
def test_real_ifc_pair_when_paths_are_provided():
    a_raw = os.environ.get("BIM_TEST_IFC_A")
    b_raw = os.environ.get("BIM_TEST_IFC_B")
    if not a_raw or not b_raw:
        pytest.skip("Defina BIM_TEST_IFC_A e BIM_TEST_IFC_B para rodar o smoke test real")

    a = Path(a_raw)
    b = Path(b_raw)
    assert a.exists() and b.exists()

    results = ClashEngine(IfcOpenShellBackend()).run(
        ClashRequest(file_a=a, file_b=b, mode="intersection", check_all=False)
    )
    assert isinstance(results, list)


@pytest.mark.skipif(
    importlib.util.find_spec("ifcopenshell") is None,
    reason="IfcOpenShell não está instalado neste ambiente",
)
def test_synthetic_known_truth_with_ifcopenshell():
    sample_dir = Path(__file__).resolve().parents[1] / "samples" / "synthetic"

    result = run_synthetic_validation(IfcOpenShellBackend(), sample_dir)

    assert result.passed is True
    assert result.overlap_count >= 1
    assert result.clear_count == 0

@pytest.mark.skipif(
    importlib.util.find_spec("ifcopenshell") is None,
    reason="IfcOpenShell não está instalado neste ambiente",
)
def test_preflight_reads_real_synthetic_ifc_geometry():
    from compatibilizabim.preflight import PreflightEngine

    sample = Path(__file__).resolve().parents[1] / "samples" / "synthetic" / "sphere_a.ifc"
    report = PreflightEngine(IfcOpenShellBackend()).run([sample])

    assert len(report.models) == 1
    model = report.models[0]
    assert model.schema == "IFC2X3"
    assert model.geometry_count >= 1
    assert model.bbox is not None
    assert model.bbox.diagonal_m > 0

@pytest.mark.skipif(
    importlib.util.find_spec("ifcopenshell") is None,
    reason="IfcOpenShell não está instalado neste ambiente",
)
def test_rule_engine_detects_known_synthetic_collision():
    from compatibilizabim.rules import ClashRule, RuleEngine

    sample_dir = Path(__file__).resolve().parents[1] / "samples" / "synthetic"
    report = RuleEngine(IfcOpenShellBackend()).run(
        sample_dir / "sphere_a.ifc",
        sample_dir / "sphere_b_overlap.ifc",
        (
            ClashRule(
                "synthetic-proxy-collision",
                "Proxy x Proxy",
                "IfcProxy",
                "IfcProxy",
                mode="collision",
                severity="critical",
            ),
        ),
    )

    assert report.raw_clash_count >= 1
    assert report.unique_clash_count >= 1


def test_native_viewer_can_extract_meshes_from_synthetic_ifc():
    pytest.importorskip("ifcopenshell")
    from compatibilizabim.ifc_backend import IfcOpenShellBackend
    from compatibilizabim.viewer import ViewerEngine

    root = Path(__file__).resolve().parents[1]
    sample = root / "samples" / "synthetic" / "sphere_a.ifc"
    session = ViewerEngine(IfcOpenShellBackend()).build([sample], max_elements=5)

    assert session.elements
    assert all(element.vertices for element in session.elements)
    assert all(element.triangles for element in session.elements)
