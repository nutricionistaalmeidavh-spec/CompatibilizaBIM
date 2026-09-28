from compatibilizabim.desktop_html import DESKTOP_HTML

def test_financial_measurement_controls_present():
    assert 'med-financial' in DESKTOP_HTML
    assert 'Gerar medição financeira' in DESKTOP_HTML
    assert 'measurement-report' in DESKTOP_HTML
