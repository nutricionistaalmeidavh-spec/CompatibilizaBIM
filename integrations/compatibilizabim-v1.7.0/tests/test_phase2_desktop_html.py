from compatibilizabim.desktop_html import DESKTOP_HTML

def test_phase2_controls_are_in_desktop_ui():
    assert "Quantitativos BIM" in DESKTOP_HTML
    assert "Orçamento 5D" in DESKTOP_HTML
    assert "/jobs/quantities" in DESKTOP_HTML
    assert "/jobs/budget" in DESKTOP_HTML
    assert "/pricebook" in DESKTOP_HTML
