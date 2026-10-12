from pathlib import Path

from compatibilizabim.desktop_server import create_server
from compatibilizabim.desktop_service import DesktopService


def test_desktop_server_refuses_non_loopback_bind(tmp_path: Path) -> None:
    service = DesktopService(tmp_path / "data")
    try:
        create_server(service, host="0.0.0.0", port=0)
    except ValueError as exc:
        assert "loopback" in str(exc)
    else:
        raise AssertionError("expected loopback restriction")
