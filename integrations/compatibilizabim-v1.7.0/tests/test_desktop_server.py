from __future__ import annotations

import json
import threading
import urllib.request
from pathlib import Path

from compatibilizabim.desktop_server import create_server
from compatibilizabim.desktop_service import DesktopService


VALID_IFC = b"ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"


def request(url: str, *, method: str = "GET", data: bytes | None = None, headers=None):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=2) as response:
        return response.status, response.read(), dict(response.headers)


def test_desktop_http_api_create_project_upload_and_list(tmp_path: Path) -> None:
    service = DesktopService(tmp_path / "data")
    server = create_server(service, host="127.0.0.1", port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        status, body, _ = request(base + "/")
        assert status == 200
        assert b"CompatibilizaBIM" in body
        assert b"drop-zone" in body

        payload = json.dumps({"name": "Hospital", "obra_id": "O-1"}).encode()
        status, body, _ = request(
            base + "/api/projects",
            method="POST",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        assert status == 201
        project = json.loads(body)

        status, body, _ = request(
            base + f"/api/projects/{project['project_id']}/models?discipline=Structure",
            method="POST",
            data=VALID_IFC,
            headers={"X-Filename": "estrutura.ifc", "Content-Type": "application/octet-stream"},
        )
        assert status == 201
        model = json.loads(body)
        assert model["discipline"] == "Structure"

        status, body, _ = request(base + f"/api/projects/{project['project_id']}")
        details = json.loads(body)
        assert len(details["models"]) == 1
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
