from compatibilizabim.desktop_html import DESKTOP_HTML

def test_desktop_exposes_official_update_and_phase2_readiness_controls():
    for token in ['sinapi-update-official','phase2-readiness','phase2-readiness-result']:
        assert f'id="{token}"' in DESKTOP_HTML
    assert '/jobs/sinapi-update' in DESKTOP_HTML
    assert '/sinapi/readiness' in DESKTOP_HTML
    assert '2026-07' in DESKTOP_HTML
