from __future__ import annotations
import json, threading, urllib.request
from pathlib import Path
from compatibilizabim.desktop_server import create_server
from compatibilizabim.desktop_service import DesktopService


def req(url,method='GET',payload=None):
    data=None if payload is None else json.dumps(payload).encode()
    r=urllib.request.Request(url,data=data,method=method,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(r,timeout=2) as x: return x.status,json.loads(x.read() or b'{}')

def test_pricebook_routes(tmp_path: Path):
    s=DesktopService(tmp_path/'data'); p=s.create_project('P'); server=create_server(s,port=0)
    t=threading.Thread(target=server.serve_forever,daemon=True); t.start(); base=f"http://127.0.0.1:{server.server_port}/api/projects/{p['project_id']}"
    try:
        st,b=req(base+'/pricebook'); assert st==200 and b['compositions']==[]
        payload={'currency':'BRL','compositions':[{'code':'X','description':'X','unit':'m2','components':[{'code':'M','description':'M','category':'material','unit':'m2','coefficient':1,'unit_cost':10}]}],'mappings':[{'composition_code':'X','ifc_class':'IfcWall','quantity_kind':'area'}]}
        st,b=req(base+'/pricebook',method='POST',payload=payload); assert st==200 and b['compositions'][0]['code']=='X'
    finally:
        server.shutdown(); server.server_close(); t.join(timeout=2)
