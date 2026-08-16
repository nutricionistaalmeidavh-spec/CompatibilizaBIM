from __future__ import annotations

import json
from dataclasses import asdict
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from .desktop_html import DESKTOP_HTML
from .desktop_service import DesktopService
from .sinapi import LATEST_VERIFIED_SINAPI, official_xlsx_url


class DesktopHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler, service: DesktopService):
        super().__init__(address, handler)
        self.service = service


class Handler(BaseHTTPRequestHandler):
    server: DesktopHTTPServer

    def log_message(self, format: str, *args) -> None:
        return

    def do_GET(self) -> None:
        try:
            self._get()
        except (ValueError, KeyError) as exc:
            self._json({"error": str(exc)}, HTTPStatus.NOT_FOUND if isinstance(exc, KeyError) else HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            self._json({"error": f"{type(exc).__name__}: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_POST(self) -> None:
        try:
            self._post()
        except (ValueError, KeyError) as exc:
            self._json({"error": str(exc)}, HTTPStatus.NOT_FOUND if isinstance(exc, KeyError) else HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            self._json({"error": f"{type(exc).__name__}: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _get(self) -> None:
        parsed = urlparse(self.path)
        parts = [unquote(part) for part in parsed.path.split("/") if part]
        if not parts:
            body = DESKTOP_HTML.encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parts == ["api", "projects"]:
            self._json(self.server.service.list_projects())
            return
        if parts == ["api", "sinapi", "latest"]:
            self._json(asdict(LATEST_VERIFIED_SINAPI) | {"xlsx_url": official_xlsx_url(LATEST_VERIFIED_SINAPI.competence)})
            return
        if len(parts) >= 3 and parts[:2] == ["api", "projects"]:
            project_id = parts[2]
            if len(parts) == 3:
                self._json(self.server.service.get_project(project_id)); return
            if parts[3:] == ["jobs"]:
                rows = [self._decorate_job(project_id, row) for row in self.server.service.list_jobs(project_id)]
                self._json(rows); return
            if len(parts) == 5 and parts[3] == "jobs":
                self._json(self._decorate_job(project_id, self.server.service.get_job(project_id, parts[4]))); return
            if parts[3:] == ["issues"]:
                self._json(self.server.service.list_issues(project_id)); return
            if parts[3:] == ["revisions"]:
                self._json(self.server.service.list_revisions(project_id)); return
            if parts[3:] == ["schedule"]:
                self._json(self.server.service.list_schedule(project_id)); return
            if parts[3:] == ["measurements"]:
                self._json(self.server.service.list_measurements(project_id)); return
            if parts[3:] == ["schedule", "simulation"]:
                q = parse_qs(parsed.query); on_date = (q.get("date") or [""])[0]
                self._json(self.server.service.get_4d_simulation(project_id, on_date)); return
            if parts[3:] == ["pricebook"]:
                self._json(self.server.service.get_pricebook(project_id)); return
            if parts[3:] == ["sinapi", "releases"]:
                self._json(self.server.service.list_sinapi_releases(project_id)); return
            if parts[3:] == ["sinapi", "selection"]:
                self._json(self.server.service.get_sinapi_selection(project_id)); return
            if parts[3:] == ["sinapi", "readiness"]:
                self._json(self.server.service.get_phase2_readiness(project_id)); return
            if parts[3:] == ["sinapi", "search"]:
                q = parse_qs(parsed.query)
                release_id = (q.get("release_id") or [""])[0]
                uf = (q.get("uf") or [""])[0]
                query = (q.get("q") or [""])[0]
                limit = int((q.get("limit") or ["20"])[0])
                self._json(self.server.service.search_sinapi_compositions(project_id, release_id, uf=uf, query=query, limit=limit)); return
            if parts[3:] == ["logs"]:
                self._json(self.server.service.read_logs(project_id)); return
            if len(parts) >= 5 and parts[3] == "files":
                relative = Path(*parts[4:])
                self._serve_project_file(project_id, relative); return
        self._json({"error": "Rota não encontrada"}, HTTPStatus.NOT_FOUND)

    def _post(self) -> None:
        parsed = urlparse(self.path)
        parts = [unquote(part) for part in parsed.path.split("/") if part]
        query = parse_qs(parsed.query)
        if parts == ["api", "projects"]:
            payload = self._read_json()
            result = self.server.service.create_project(str(payload.get("name") or ""), obra_id=payload.get("obra_id"))
            self._json(result, HTTPStatus.CREATED); return
        if len(parts) >= 4 and parts[:2] == ["api", "projects"]:
            project_id = parts[2]
            if parts[3:] == ["models"]:
                length = int(self.headers.get("Content-Length") or "0")
                if length <= 0:
                    raise ValueError("Arquivo vazio")
                if length > 1024 * 1024 * 1024:
                    raise ValueError("Arquivo excede o limite de 1 GB desta versão")
                filename = self.headers.get("X-Filename") or "model.ifc"
                body = self.rfile.read(length)
                discipline = (query.get("discipline") or [None])[0]
                result = self.server.service.import_model_bytes(project_id, filename, body, discipline=discipline)
                self._json(result, HTTPStatus.CREATED); return
            if parts[3:] == ["measurements"]:
                self._json(self.server.service.create_measurement(project_id, self._read_json()), HTTPStatus.CREATED); return
            if parts[3:] == ["measurements", "export"]:
                self._json(self.server.service.export_measurements_csv(project_id)); return
            if len(parts) == 6 and parts[3] == "measurements" and parts[5] == "approve":
                payload = self._read_json(); self._json(self.server.service.approve_measurement(project_id, parts[4], approved_by=str(payload.get("approved_by") or ""))); return
            if len(parts) == 6 and parts[3] == "measurements" and parts[5] == "reject":
                payload = self._read_json(); self._json(self.server.service.reject_measurement(project_id, parts[4], reason=str(payload.get("reason") or ""))); return
            if parts[3:] == ["schedule", "import"]:
                length = int(self.headers.get("Content-Length") or "0")
                if length <= 0 or length > 50 * 1024 * 1024:
                    raise ValueError("Cronograma CSV vazio ou acima de 50 MB")
                filename = self.headers.get("X-Filename") or "schedule.csv"
                self._json(self.server.service.import_schedule_csv_bytes(project_id, filename, self.rfile.read(length)), HTTPStatus.CREATED); return
            if parts[3:] == ["schedule", "activities"]:
                self._json(self.server.service.add_schedule_activity(project_id, self._read_json()), HTTPStatus.CREATED); return
            if len(parts) == 6 and parts[3] == "schedule" and parts[4] and parts[5] == "link":
                payload = self._read_json(); self._json(self.server.service.link_schedule_elements(project_id, parts[4], payload.get("guids") or [], replace_existing=bool(payload.get("replace_existing", False)))); return
            if len(parts) == 6 and parts[3] == "schedule" and parts[4] and parts[5] == "progress":
                payload = self._read_json(); self._json(self.server.service.update_schedule_progress(project_id, parts[4], float(payload.get("progress") or 0), actual_start=payload.get("actual_start"), actual_finish=payload.get("actual_finish"), recorded_on=payload.get("recorded_on"))); return
            if parts[3:] == ["jobs", "measurement-report"]:
                self._json(self.server.service.start_measurement_financial_report(project_id), HTTPStatus.ACCEPTED); return
            if parts[3:] == ["jobs", "viewer4d"]:
                payload = self._read_json(optional=True); max_elements = payload.get("max_elements")
                self._json(self.server.service.start_4d_viewer(project_id, max_elements=int(max_elements) if max_elements else None), HTTPStatus.ACCEPTED); return
            if parts[3:] == ["jobs", "preflight"]:
                payload = self._read_json(optional=True)
                result = self.server.service.start_preflight(project_id, alignment_tolerance_m=float(payload.get("alignment_tolerance_m") or 5.0))
                self._json(result, HTTPStatus.ACCEPTED); return
            if parts[3:] == ["jobs", "viewer"]:
                payload = self._read_json(optional=True)
                max_elements = payload.get("max_elements")
                result = self.server.service.start_viewer(project_id, max_elements=int(max_elements) if max_elements else None)
                self._json(result, HTTPStatus.ACCEPTED); return
            if parts[3:] == ["jobs", "rules"]:
                payload = self._read_json()
                result = self.server.service.start_rules(
                    project_id,
                    str(payload.get("model_a_id") or ""),
                    str(payload.get("model_b_id") or ""),
                    preset=str(payload.get("preset") or "mep-structure"),
                )
                self._json(result, HTTPStatus.ACCEPTED); return
            if parts[3:] == ["jobs", "quantities"]:
                payload = self._read_json(optional=True)
                ids = payload.get("model_ids")
                if ids is not None and not isinstance(ids, list):
                    raise ValueError("model_ids deve ser uma lista")
                result = self.server.service.start_quantities(
                    project_id, model_ids=[str(x) for x in ids] if ids else None,
                    geometry_fallback=bool(payload.get("geometry_fallback", True)),
                )
                self._json(result, HTTPStatus.ACCEPTED); return
            if parts[3:] == ["jobs", "budget"]:
                payload = self._read_json(optional=True)
                result = self.server.service.start_budget(project_id, quantities_report=payload.get("quantities_report"))
                self._json(result, HTTPStatus.ACCEPTED); return
            if parts[3:] == ["jobs", "sinapi-update"]:
                payload = self._read_json(optional=True)
                result = self.server.service.start_official_sinapi_update(
                    project_id, competence=str(payload.get("competence") or LATEST_VERIFIED_SINAPI.competence)
                )
                self._json(result, HTTPStatus.ACCEPTED); return
            if parts[3:] == ["pricebook"]:
                payload = self._read_json()
                self._json(self.server.service.save_pricebook(project_id, payload)); return
            if parts[3:] == ["sinapi", "import"]:
                length = int(self.headers.get("Content-Length") or "0")
                if length <= 0:
                    raise ValueError("Arquivo SINAPI vazio")
                if length > 512 * 1024 * 1024:
                    raise ValueError("Arquivo SINAPI excede o limite de 512 MB")
                filename = self.headers.get("X-Filename") or "sinapi.zip"
                competence = (query.get("competence") or [""])[0]
                body = self.rfile.read(length)
                self._json(self.server.service.import_sinapi_bytes(project_id, filename, body, competence=competence), HTTPStatus.CREATED); return
            if parts[3:] == ["sinapi", "suggest"]:
                payload = self._read_json()
                self._json(self.server.service.suggest_sinapi_mappings(
                    project_id, str(payload.get("release_id") or ""), uf=str(payload.get("uf") or ""),
                    limit_per_group=int(payload.get("limit_per_group") or 3),
                )); return
            if parts[3:] == ["sinapi", "activate"]:
                payload = self._read_json()
                self._json(self.server.service.activate_sinapi_pricebook(
                    project_id, str(payload.get("release_id") or ""), uf=str(payload.get("uf") or ""),
                    bdi_percent=float(payload.get("bdi_percent") or 0.0), mappings=payload.get("mappings") or [],
                )); return
            if parts[3:] == ["sinapi", "compare"]:
                payload = self._read_json()
                self._json(self.server.service.compare_sinapi_releases(
                    project_id, str(payload.get("old_release_id") or ""), str(payload.get("new_release_id") or ""),
                    uf=str(payload.get("uf") or ""), codes=payload.get("codes"),
                )); return
            if parts[3:] == ["sinapi", "reprice"]:
                payload = self._read_json()
                self._json(self.server.service.compare_sinapi_budgets(
                    project_id, str(payload.get("old_release_id") or ""), str(payload.get("new_release_id") or ""),
                    uf=str(payload.get("uf") or ""), bdi_percent=float(payload.get("bdi_percent") or 0.0),
                    mappings=payload.get("mappings") or [], quantities_report=payload.get("quantities_report"),
                )); return
            if len(parts) == 5 and parts[3] == "issues":
                payload = self._read_json()
                result = self.server.service.update_issue(project_id, parts[4], **payload)
                self._json(result); return
            if len(parts) == 6 and parts[3] == "issues" and parts[5] == "comments":
                payload = self._read_json()
                result = self.server.service.add_issue_comment(
                    project_id, parts[4], author=str(payload.get("author") or ""), text=str(payload.get("text") or "")
                )
                self._json(result, HTTPStatus.CREATED); return
            if parts[3:] == ["revisions", "compare"]:
                payload = self._read_json()
                result = self.server.service.compare_revisions(
                    project_id, str(payload.get("base_revision") or ""), str(payload.get("current_revision") or "")
                )
                self._json(result); return
            if len(parts) == 6 and parts[3] == "jobs" and parts[5] == "cancel":
                result = self.server.service.cancel_job(project_id, parts[4])
                self._json(result); return
        self._json({"error": "Rota não encontrada"}, HTTPStatus.NOT_FOUND)

    def _read_json(self, *, optional: bool = False) -> dict:
        length = int(self.headers.get("Content-Length") or "0")
        if length == 0 and optional:
            return {}
        raw = self.rfile.read(length) if length else b"{}"
        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("JSON inválido") from exc
        if not isinstance(value, dict):
            raise ValueError("JSON deve ser um objeto")
        return value

    def _decorate_job(self, project_id: str, row: dict) -> dict:
        result = dict(row)
        if isinstance(result.get("result"), dict):
            payload = dict(result["result"])
            for key, url_key in (("viewer_path", "viewer_url"), ("report_path", "report_url"), ("csv_path", "csv_url"), ("pdf_path", "pdf_url")):
                if payload.get(key):
                    name = Path(str(payload[key])).name
                    payload[url_key] = f"/api/projects/{project_id}/files/reports/{name}"
            result["result"] = payload
        return result

    def _serve_project_file(self, project_id: str, relative: Path) -> None:
        project = self.server.service.projects.get_project(project_id)
        base = project.path.resolve()
        path = (base / relative).resolve()
        if path != base and base not in path.parents:
            raise ValueError("Caminho inválido")
        if not path.is_file():
            raise KeyError("Arquivo não encontrado")
        data = path.read_bytes()
        suffix = path.suffix.lower()
        content_type = ("text/html; charset=utf-8" if suffix == ".html" else "application/json; charset=utf-8" if suffix == ".json" else "text/csv; charset=utf-8" if suffix == ".csv" else "application/pdf" if suffix == ".pdf" else "application/octet-stream")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _json(self, payload, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def create_server(service: DesktopService, *, host: str = "127.0.0.1", port: int = 8787) -> DesktopHTTPServer:
    if host not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("Por segurança, o desktop server só pode escutar em loopback")
    return DesktopHTTPServer((host, port), Handler, service)
