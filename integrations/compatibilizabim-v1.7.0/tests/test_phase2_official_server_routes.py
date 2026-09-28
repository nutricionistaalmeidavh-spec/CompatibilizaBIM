from __future__ import annotations

import io, json, threading, time, urllib.request
from pathlib import Path
from zipfile import ZipFile
from openpyxl import Workbook

from compatibilizabim.budget import BudgetEngine, PriceBookStore, write_budget_json
from compatibilizabim.desktop_server import create_server
from compatibilizabim.desktop_service import DesktopService
from compatibilizabim.sinapi import DownloadedSinapiArchive


def _archive(path: Path):
    x=io.BytesIO(); wb=Workbook(); ws=wb.active; ws.title='Composicoes'; ws.append(['Código','Descrição','Unidade','SP']); ws.append([103328,'ALVENARIA CERAMICA','M2',84]); wb.save(x)
    with ZipFile(path,'w') as zf: zf.writestr('r.xlsx',x.getvalue())

class Fake:
    def download(self, competence, destination_dir):
        destination_dir.mkdir(parents=True,exist_ok=True); p=destination_dir/f'SINAPI-{competence}-formato-xlsx.zip'; _archive(p)
        return DownloadedSinapiArchive(p,competence,f'https://www.caixa.gov.br/Downloads/x/{p.name}','fake','2026-08-15T10:00:00+00:00',('r.xlsx',))

def req(url, method='GET', payload=None):
    data=None; headers={}
    if payload is not None: data=json.dumps(payload).encode(); headers['Content-Type']='application/json'
    with urllib.request.urlopen(urllib.request.Request(url,data=data,method=method,headers=headers),timeout=3) as r:
        return r.status, json.loads(r.read() or b'{}')

def _wait(base, jid):
    for _ in range(200):
        _, row=req(base+'/jobs/'+jid)
        if row['status'] in {'completed','failed'}: return row
        time.sleep(.01)
    raise AssertionError('timeout')

def test_server_exposes_latest_update_and_readiness(tmp_path: Path):
    s=DesktopService(tmp_path/'data',sinapi_downloader=Fake()); p=s.create_project('P'); pid=p['project_id']
    server=create_server(s,port=0); t=threading.Thread(target=server.serve_forever,daemon=True); t.start()
    root=f'http://127.0.0.1:{server.server_port}'; base=f'{root}/api/projects/{pid}'
    try:
        st,latest=req(root+'/api/sinapi/latest'); assert st==200 and latest['competence']=='2026-07'
        st,job=req(base+'/jobs/sinapi-update',method='POST',payload={}); assert st==202
        done=_wait(base,job['job_id']); assert done['status']=='completed'
        rid=done['result']['release_id']
        mapping=[{'composition_code':'103328','ifc_class':'IfcWall','quantity_kind':'area','quantity_name_contains':'NetArea'}]
        req(base+'/sinapi/activate',method='POST',payload={'release_id':rid,'uf':'SP','bdi_percent':0,'mappings':mapping})
        project=s.projects.get_project(pid); reports=project.path/'reports'
        quantities={'groups':[{'discipline':'Architecture','source':'ifc_qto','storey':'T','ifc_class':'IfcWall','type_name':'14cm','material':None,'quantity_name':'NetArea','kind':'area','unit':'m2','value':10,'element_count':1}]}
        (reports/'quantities-JOB-X.json').write_text(json.dumps(quantities),encoding='utf-8')
        budget=BudgetEngine().calculate(quantities,PriceBookStore(project.path/'costs'/'pricebook.json').load()); write_budget_json(reports/'budget-JOB-X.json',budget)
        st,ready=req(base+'/sinapi/readiness'); assert st==200 and ready['ready_for_reference_budget'] is True
    finally:
        server.shutdown(); server.server_close(); t.join(timeout=2)
