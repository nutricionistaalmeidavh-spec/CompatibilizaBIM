from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "samples" / "synthetic"


def test_synthetic_ifc_fixtures_exist_with_expected_offsets():
    overlap_a = SAMPLES / "sphere_a.ifc"
    overlap_b = SAMPLES / "sphere_b_overlap.ifc"
    clear_b = SAMPLES / "sphere_b_clear.ifc"

    assert overlap_a.exists()
    assert overlap_b.exists()
    assert clear_b.exists()

    a_text = overlap_a.read_text(encoding="utf-8")
    overlap_text = overlap_b.read_text(encoding="utf-8")
    clear_text = clear_b.read_text(encoding="utf-8")

    assert "IFCSPHERE" not in a_text  # source geometry is a revolved circle profile
    assert "IFCCIRCLEPROFILEDEF(.AREA.,$,#20,400.0)" in a_text
    assert "IFCCARTESIANPOINT((0.0,0.0,0.0))" in a_text
    assert "IFCCARTESIANPOINT((600.0,0.0,0.0))" in overlap_text
    assert "IFCCARTESIANPOINT((1000.0,0.0,0.0))" in clear_text
