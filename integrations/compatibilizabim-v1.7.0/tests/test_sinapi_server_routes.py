from __future__ import annotations
import io, json, threading, urllib.parse, urllib.request
from pathlib import Path
from zipfile import ZipFile
from openpyxl import Workbook
from compatibilizabim.desktop_server import create_server
from compatibilizabim.desktop_service import DesktopService


def archive_bytes():
    x=io.BytesIO(); wb=Workbook(); ws=wb.active; ws.title='Composicoes'; ws.append(['Código','Descrição','Unidade','SP']); ws.append([10,'ALVENARIA CERAMICA','M2',75]); wb.save(x)
    z=io.BytesIO();
    with ZipFile(z,'w') as f:f.writestr('r.xlsx',x.getvalue())
    return z.getvalue()

def request(url, method='GET', payload=None, headers=None):
    data=None
    hdr=dict(headers or {})
    if isinstance(payload,(bytes,bytearray)): data=payload
    elif payload is not None: data=json.dumps(payload).encode(); hdr['Content-Type']='application/json'
    req=urllib.request.Request(url,data=data,method=method,headers=hdr)
    with urllib.request.urlopen(req,timeout=3) as r:
        raw=r.read(); return r.status, json.loads(raw or b'{}')

def test_sinapi_http_routes(tmp_path: Path):
    s=DesktopService(tmp_path/'data'); p=s.create_project('P'); server=create_server(s,port=0); t=threading.Thread(target=server.serve_forever,daemon=True); t.start()
    base=f"http://127.0.0.1:{server.server_port}/api/projects/{p['project_id']}"
    try:
        st,rel=request(base+'/sinapi/import?competence=2026-07',method='POST',payload=archive_bytes(),headers={'X-Filename':'sinapi.zip','Content-Type':'application/octet-stream'})
        assert st==201
        rid=rel['release_id']
        st,rows=request(base+'/sinapi/releases'); assert st==200 and rows[0]['release_id']==rid
        st,hits=request(base+'/sinapi/search?release_id='+urllib.parse.quote(rid)+'&uf=SP&q=alvenaria'); assert st==200 and hits[0]['code']=='10'
        mapping={'release_id':rid,'uf':'SP','bdi_percent':15,'mappings':[{'composition_code':'10','ifc_class':'IfcWall','quantity_kind':'area'}]}
        st,book=request(base+'/sinapi/activate',method='POST',payload=mapping); assert st==200 and book['source']=='SINAPI'
    finally:
        server.shutdown(); server.server_close(); t.join(timeout=2)
