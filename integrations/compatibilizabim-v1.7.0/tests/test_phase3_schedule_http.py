import json, threading, urllib.request
from pathlib import Path
from compatibilizabim.desktop_server import create_server
from compatibilizabim.desktop_service import DesktopService


def req(url,method='GET',payload=None,body=None,headers=None):
    data=body if body is not None else (None if payload is None else json.dumps(payload).encode())
    h=headers or ({'Content-Type':'application/json'} if payload is not None else {})
    r=urllib.request.Request(url,data=data,method=method,headers=h)
    with urllib.request.urlopen(r,timeout=2) as x:return x.status,json.loads(x.read() or b'{}')

def test_schedule_http_routes(tmp_path: Path):
    s=DesktopService(tmp_path/'data'); p=s.create_project('P'); server=create_server(s,port=0)
    t=threading.Thread(target=server.serve_forever,daemon=True);t.start();base=f"http://127.0.0.1:{server.server_port}/api/projects/{p['project_id']}"
    try:
        st,a=req(base+'/schedule/activities',method='POST',payload={'activity_id':'A1','name':'Fundacao','start_date':'2026-09-01','end_date':'2026-09-05'}); assert st==201 and a['activity_id']=='A1'
        st,rows=req(base+'/schedule'); assert st==200 and rows[0]['name']=='Fundacao'
        st,a=req(base+'/schedule/A1/link',method='POST',payload={'guids':['G1']}); assert a['linked_guids']==['G1']
        st,a=req(base+'/schedule/A1/progress',method='POST',payload={'progress':25}); assert a['actual_progress']==25
    finally:
        server.shutdown();server.server_close();t.join(timeout=2)

def test_desktop_html_has_4d_controls():
    from compatibilizabim.desktop_html import DESKTOP_HTML
    assert 'Planejamento 4D' in DESKTOP_HTML and 'schedule-import' in DESKTOP_HTML and 'sch-progress-btn' in DESKTOP_HTML
