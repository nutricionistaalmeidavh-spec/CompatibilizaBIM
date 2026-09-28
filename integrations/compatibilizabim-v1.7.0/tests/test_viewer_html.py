from pathlib import Path

from compatibilizabim.viewer import MeshElement, ViewerSession
from compatibilizabim.viewer_html import write_viewer_html


def test_viewer_html_is_self_contained_and_embeds_session(tmp_path):
    session = ViewerSession.from_elements(
        (
            MeshElement(
                global_id="GUID-1",
                ifc_class="IfcWall",
                name="Parede",
                discipline="Architecture",
                source_file="arc.ifc",
                vertices=(0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 2.0, 0.0),
                triangles=(0, 1, 2),
            ),
        )
    )
    output = tmp_path / "viewer.html"

    write_viewer_html(output, session)

    text = output.read_text(encoding="utf-8")
    assert '<canvas id="viewer-canvas"' in text
    assert 'id="session-data"' in text
    assert 'GUID-1' in text
    assert 'data-action="fit"' in text
    assert 'data-action="viewpoint"' in text
    assert 'https://' not in text
    assert 'http://' not in text
    assert output.stat().st_size > 5_000


def test_viewer_html_escapes_untrusted_ifc_text_inside_embedded_json(tmp_path):
    session = ViewerSession.from_elements(
        (
            MeshElement(
                global_id="GUID-XSS",
                ifc_class="IfcWall",
                name="</script><script>bad()</script>",
                discipline="Architecture",
                source_file="arc.ifc",
                vertices=(0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0),
                triangles=(0, 1, 2),
            ),
        )
    )
    output = tmp_path / "viewer.html"

    write_viewer_html(output, session)

    text = output.read_text(encoding="utf-8")
    assert "</script><script>bad()" not in text
    assert "\\u003c/script\\u003e" in text
