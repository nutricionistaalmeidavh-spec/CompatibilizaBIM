from __future__ import annotations

import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from cbim_sdk import CBIMProject
from compatibilizabim_core.commercial.workspace import WorkspaceStore
from compatibilizabim_core.commercial.recovery import AutosaveManager
from compatibilizabim_core.product.reporting import build_conversion_report
from compatibilizabim_core.product.studio import write_studio


class DesktopApplication:
    def __init__(self, workspace: str | Path):
        self.store=WorkspaceStore(workspace)
        self.autosave=AutosaveManager(self.store)

    def generate_studio(self) -> Path:
        project=self.store.load_project();plan=self.store.load_import_plan();report=build_conversion_report(project,import_plan=plan)
        out=self.store.root/'desktop'/'studio.html';out.parent.mkdir(exist_ok=True)
        write_studio(project,plan,report,out)
        return out

    def status_payload(self)->dict:
        return self.store.status().model_dump(mode='json')

    def recovery_payload(self)->list[dict]:
        return [c.model_dump(mode='json') for c in self.autosave.recovery_candidates()]

    def save_project_payload(self, raw: bytes) -> dict:
        project=CBIMProject.model_validate_json(raw)
        self.autosave.autosave(project)
        self.store.save_project(project)
        return self.store.status().model_dump(mode='json')

    def handler(self):
        app=self
        class Handler(BaseHTTPRequestHandler):
            def _send(self,status:int,content_type:str,body:bytes):
                self.send_response(status);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
            def do_GET(self):
                path=urlparse(self.path).path
                if path=='/':
                    self._send(200,'text/html; charset=utf-8',app.generate_studio().read_bytes())
                elif path=='/api/status':
                    self._send(200,'application/json',json.dumps(app.status_payload(),ensure_ascii=False).encode())
                elif path=='/api/recovery':
                    self._send(200,'application/json',json.dumps(app.recovery_payload(),ensure_ascii=False).encode())
                else:self._send(404,'text/plain',b'not found')
            def do_POST(self):
                if urlparse(self.path).path!='/api/project':return self._send(404,'text/plain',b'not found')
                try:
                    n=int(self.headers.get('Content-Length','0'));payload=app.save_project_payload(self.rfile.read(n))
                    self._send(200,'application/json',json.dumps(payload,ensure_ascii=False).encode())
                except Exception as exc:self._send(400,'application/json',json.dumps({'error':str(exc)}).encode())
            def log_message(self,format,*args): return
        return Handler

    def start(self,*,host='127.0.0.1',port=0,open_browser=False):
        server=ThreadingHTTPServer((host,port),self.handler())
        if open_browser:webbrowser.open(f'http://{host}:{server.server_address[1]}/')
        return server


def serve_workspace(workspace:str|Path,*,host='127.0.0.1',port=8765,open_browser=True):
    app=DesktopApplication(workspace);app.autosave.begin_session();server=app.start(host=host,port=port,open_browser=open_browser)
    try:server.serve_forever()
    finally:
        app.autosave.mark_clean_shutdown();server.server_close()
