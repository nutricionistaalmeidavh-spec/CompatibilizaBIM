from scripts.generate_viewer_demo import build_demo_session
from compatibilizabim.viewer import viewer_manifest


def test_demo_session_contains_two_disciplines_and_focusable_clash():
    session = build_demo_session()
    manifest = viewer_manifest(session)

    assert {"MEP", "Structure"} <= set(manifest["disciplines"])
    assert len(manifest["elements"]) == 2
    assert len(manifest["clashes"]) == 1
    assert manifest["clashes"][0]["a_global_id"] == "DEMO-PIPE"
    assert manifest["clashes"][0]["b_global_id"] == "DEMO-BEAM"
