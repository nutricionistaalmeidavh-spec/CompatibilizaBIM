from compatibilizabim.desktop_html import DESKTOP_HTML

def test_desktop_contains_sinapi_controls():
    for token in ['sinapi-file','sinapi-competence','sinapi-uf','sinapi-release','sinapi-search','sinapi-results','sinapi-activate','sinapi-compare']:
        assert f'id="{token}"' in DESKTOP_HTML
    assert '/sinapi/import' in DESKTOP_HTML
    assert '/sinapi/search' in DESKTOP_HTML
    assert '/sinapi/activate' in DESKTOP_HTML
