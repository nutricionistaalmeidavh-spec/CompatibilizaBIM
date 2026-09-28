from compatibilizabim.desktop_html import DESKTOP_HTML

def test_desktop_exposes_issues_and_revisions_ui():
    assert "Pendências / Issues" in DESKTOP_HTML
    assert "Revisões" in DESKTOP_HTML
    assert "/issues/" in DESKTOP_HTML
    assert "/revisions/compare" in DESKTOP_HTML
