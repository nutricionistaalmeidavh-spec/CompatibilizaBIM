from __future__ import annotations

import json
import threading
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlparse
from http.client import HTTPConnection
from urllib.request import Request, urlopen

import pytest
from cbim_sdk import CBIMProject
from compatibilizabim_core.commercial.workspace import WorkspaceStore
from compatibilizabim_core.product.import_wizard import build_import_plan
from compatibilizabim_core.product.models import ProjectConfiguration
from compatibilizabim_core.desktop.server import DesktopApplication


@pytest.fixture()
def secured_studio(tmp_path):
    artifact = Path(__file__).resolve().parents[2] / "artifacts" / "cad-to-cbim-demo.cbim.json"
    project = CBIMProject.model_validate_json(artifact.read_text(encoding="utf-8"))
    plan = build_import_plan(["ARQ_TORRE.dwg"], ProjectConfiguration(project_name=project.name))
    store = WorkspaceStore.create(tmp_path / "projeto", project, plan)
    app = DesktopApplication(store.root, session_token="test-session-secret")
    app.autosave.begin_session()
    server = app.start(host="127.0.0.1", port=0, open_browser=False)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield app, store, f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def request(base, route, *, cookie=None, payload=None):
    headers = {}
    if cookie:
        headers["Cookie"] = cookie
    if payload is not None:
        headers["Content-Type"] = "application/json"
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    return urlopen(Request(base + route, data=body, headers=headers, method="POST" if payload is not None else "GET"), timeout=5)


def test_studio_cannot_open_or_read_without_session(secured_studio):
    _, _, base = secured_studio
    with pytest.raises(HTTPError) as err:
        request(base, "/")
    assert err.value.code == 403
    with pytest.raises(HTTPError) as err:
        request(base, "/api/status")
    assert err.value.code == 403
    with pytest.raises(HTTPError) as err:
        request(base, "/api/recovery")
    assert err.value.code == 403


def test_studio_issues_http_only_cookie_and_rejects_cross_session_save(secured_studio):
    _, store, base = secured_studio
    with request(base, "/?token=test-session-secret") as resp:
        assert resp.status == 200
        cookie = resp.headers["Set-Cookie"]
        assert "HttpOnly" in cookie and "SameSite=Strict" in cookie
        assert "CompatibilizaBIM Studio" in resp.read().decode("utf-8")

    initial = store.status().revision
    with pytest.raises(HTTPError) as err:
        request(base, "/api/project", payload={"malicious": True})
    assert err.value.code == 403
    assert store.status().revision == initial

    project = store.load_project()
    project.name = "Projeto revisado"
    with request(base, "/api/project", cookie=cookie.split(";", 1)[0], payload=project.model_dump(mode="json", exclude_computed_fields=True)) as resp:
        assert resp.status == 200
    assert store.status().revision == initial + 1
    assert store.load_project().name == "Projeto revisado"
    assert list((store.root / "revisions").glob("*.cbim.json"))


def test_studio_restore_requires_snapshot_id_not_arbitrary_path(secured_studio):
    _, store, base = secured_studio
    with request(base, "/?token=test-session-secret") as resp:
        cookie = resp.headers["Set-Cookie"].split(";", 1)[0]
    original = store.load_project().name
    changed = store.load_project()
    changed.name = "Versão posterior"
    with request(base, "/api/project", cookie=cookie, payload=changed.model_dump(mode="json", exclude_computed_fields=True)):
        pass
    with request(base, "/api/history", cookie=cookie) as resp:
        history = json.load(resp)
    assert history["snapshots"]
    snapshot = history["snapshots"][0]["name"]

    with pytest.raises(HTTPError) as err:
        request(base, "/api/restore", cookie=cookie, payload={"snapshot": "../../anything"})
    assert err.value.code == 400

    with request(base, "/api/restore", cookie=cookie, payload={"snapshot": snapshot}) as resp:
        restored = json.load(resp)
    assert restored["project_name"] == original
    assert store.load_project().name == original


def test_studio_rejects_payload_above_configured_limit(secured_studio):
    _, store, base = secured_studio
    with request(base, "/?token=test-session-secret") as resp:
        cookie = resp.headers["Set-Cookie"].split(";", 1)[0]
    # Test the advertised length before transmitting a giant body. When a server
    # rejects early with 413 it may close the client socket (BrokenPipe).
    uri = urlparse(base)
    conn = HTTPConnection(uri.hostname, uri.port, timeout=5)
    try:
        conn.putrequest("POST", "/api/project")
        conn.putheader("Cookie", cookie)
        conn.putheader("Content-Type", "application/json")
        conn.putheader("Content-Length", str(16 * 1024 * 1024 + 1))
        conn.endheaders()
        response = conn.getresponse()
        assert response.status == 413
    finally:
        conn.close()
    assert store.status().revision == 0


def test_studio_recovers_interrupted_autosave_from_authenticated_ui(secured_studio):
    app, store, base = secured_studio
    with request(base, "/?token=test-session-secret") as resp:
        cookie = resp.headers["Set-Cookie"].split(";", 1)[0]

    recovered = store.load_project()
    recovered.name = "Versão recuperável"
    app.autosave.autosave(recovered)
    app.autosave.begin_session()  # simula nova abertura após encerramento inesperado
    current = store.load_project()
    assert current.name != recovered.name

    with request(base, "/api/recovery", cookie=cookie) as resp:
        candidates = json.load(resp)
    assert candidates and candidates[0]["id"]
    assert "path" not in candidates[0]

    with request(base, "/api/recover", cookie=cookie, payload={"candidate": candidates[0]["id"]}) as resp:
        result = json.load(resp)
    assert result["project_name"] == "Versão recuperável"
    assert store.load_project().name == "Versão recuperável"
    assert list((store.root / "revisions").glob("*.cbim.json"))
    assert app.autosave.recovery_candidates() == []


def test_studio_saves_project_and_import_plan_as_one_workspace_action(secured_studio):
    _, store, base = secured_studio
    with request(base, "/?token=test-session-secret") as resp:
        cookie = resp.headers["Set-Cookie"].split(";", 1)[0]

    project = store.load_project()
    project.name = "Projeto comercial"
    plan = store.load_import_plan()
    plan.config.project_name = project.name
    plan.config.organization = "ArtiSys"
    payload = {
        "project": project.model_dump(mode="json", exclude_computed_fields=True),
        "plan": plan.model_dump(mode="json"),
    }
    with request(base, "/api/workspace", cookie=cookie, payload=payload) as resp:
        result = json.load(resp)

    assert result["project_name"] == "Projeto comercial"
    assert store.load_project().name == "Projeto comercial"
    assert store.load_import_plan().config.organization == "ArtiSys"
