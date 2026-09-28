import json, threading, urllib.request
from pathlib import Path
from compatibilizabim.desktop_server import create_server
from compatibilizabim.desktop_service import DesktopService

def req(url,method='GET',payload=None):
    data=None if payload is None else json.dumps(payload).encode(); h={'Content-Type':'application/json'} if payload is not None else {}
    r=urllib.request.Request(url,data=data,method=method,headers=h)
    with urllib.request.urlopen(r,timeout=2) as x:return x.status,json.loads(x.read() or b'{}')

def test_simulation_route(tmp_path: Path):
    s=DesktopService(tmp_path/'data'); p=s.create_project('P'); pid=p['project_id']; s.add_schedule_activity(pid,{'activity_id':'A1','name':'X','start_date':'2026-09-01','end_date':'2026-09-05'}); s.update_schedule_progress(pid,'A1',20,recorded_on='2026-09-03')
    server=create_server(s,port=0); t=threading.Thread(target=server.serve_forever,daemon=True);t.start(); base=f"http://127.0.0.1:{server.server_port}/api/projects/{pid}"
    try:
        st,r=req(base+'/schedule/simulation?date=2026-09-03'); assert st==200 and 'overall' in r
    finally:server.shutdown();server.server_close();t.join(timeout=2)

def test_desktop_html_has_simulation_controls():
    from compatibilizabim.desktop_html import DESKTOP_HTML
    assert 'sim-run' in DESKTOP_HTML and 'viewer4d' in DESKTOP_HTML and 'sim-result' in DESKTOP_HTML
