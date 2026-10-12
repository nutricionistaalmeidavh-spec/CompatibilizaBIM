from pathlib import Path

from compatibilizabim.selftest import default_sample_dir


def test_selftest_fixtures_live_inside_package_tree() -> None:
    path = default_sample_dir()
    assert path.name == "synthetic"
    assert path.parent.name == "data"
    assert (path / "sphere_a.ifc").is_file()
