from __future__ import annotations

import io, json
from pathlib import Path
from zipfile import ZipFile
from openpyxl import Workbook

from compatibilizabim.desktop_service import DesktopService


def _archive(price: float) -> bytes:
    stream = io.BytesIO()
    wb = Workbook(); ws = wb.active; ws.title='Composicoes'
    ws.append(['Código','Descrição','Unidade','SP'])
    ws.append([103328,'ALVENARIA DE VEDACAO BLOCOS CERAMICOS 14CM','M2',price])
    xlsx = io.BytesIO(); wb.save(xlsx)
    with ZipFile(stream,'w') as zf: zf.writestr('relatorio.xlsx',xlsx.getvalue())
    return stream.getvalue()


def test_project_sinapi_import_search_activate_and_reprice(tmp_path: Path):
    s=DesktopService(tmp_path/'data'); p=s.create_project('P'); pid=p['project_id']
    old=s.import_sinapi_bytes(pid,'SINAPI_202606.zip',_archive(80.0),competence='2026-06')
    new=s.import_sinapi_bytes(pid,'SINAPI_202607.zip',_archive(84.0),competence='2026-07')
    assert len(s.list_sinapi_releases(pid))==2
    hits=s.search_sinapi_compositions(pid,new['release_id'],uf='SP',query='alvenaria ceramicos')
    assert hits[0]['code']=='103328' and hits[0]['price']==84.0

    mappings=[{'composition_code':'103328','ifc_class':'IfcWall','quantity_kind':'area','quantity_name_contains':'NetArea'}]
    book=s.activate_sinapi_pricebook(pid,new['release_id'],uf='SP',bdi_percent=20,mappings=mappings)
    assert book['source']=='SINAPI' and book['reference_date']=='2026-07/SP'
    assert (Path(s.projects.get_project(pid).path)/'costs'/'sinapi-selection.json').is_file()

    q={'groups':[{'discipline':'Architecture','storey':'Térreo','ifc_class':'IfcWall','type_name':'14cm','material':'ceramico','quantity_name':'NetArea','kind':'area','unit':'m2','value':100,'element_count':5,'source':'qto'}]}
    reports=Path(s.projects.get_project(pid).path)/'reports'; reports.mkdir(exist_ok=True)
    (reports/'quantities-JOB-TEST.json').write_text(json.dumps(q),encoding='utf-8')
    comparison=s.compare_sinapi_budgets(pid,old['release_id'],new['release_id'],uf='SP',bdi_percent=0,mappings=mappings)
    assert comparison['old_total']==8000.0
    assert comparison['new_total']==8400.0
    assert comparison['variation']==400.0
    assert comparison['variation_percent']==5.0
