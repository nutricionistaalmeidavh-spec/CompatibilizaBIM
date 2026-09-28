from __future__ import annotations

import json
import threading
import urllib.request
from pathlib import Path

from compatibilizabim.desktop_server import create_server
from compatibilizabim.desktop_service import DesktopService
from compatibilizabim.issues import BimIssue, IssueStore


def req(url, *, method="GET", payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(url, method=method, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=2) as response:
        return response.status, json.loads(response.read() or b"{}")


def test_issue_and_revision_routes_exist(tmp_path: Path) -> None:
    service = DesktopService(tmp_path / "data")
    project = service.create_project("P")
    server = create_server(service, port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    base = f"http://127.0.0.1:{server.server_port}/api/projects/{project['project_id']}"
    try:
        status, issues = req(base + "/issues")
        assert status == 200 and issues == []
        status, revisions = req(base + "/revisions")
        assert status == 200 and revisions == []
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)
