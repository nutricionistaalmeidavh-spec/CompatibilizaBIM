from __future__ import annotations
import json
from pathlib import Path
from zipfile import ZipFile
from openpyxl import Workbook
from compatibilizabim.sinapi_cli import main


def _archive(tmp_path: Path) -> Path:
    x=tmp_path/'r.xlsx'; wb=Workbook(); ws=wb.active; ws.title='Composicoes'
    ws.append(['Código','Descrição','Unidade','SP']); ws.append([1,'ALVENARIA CERAMICA','M2',50]); wb.save(x)
    z=tmp_path/'r.zip';
    with ZipFile(z,'w') as f:f.write(x,x.name)
    return z


def test_sinapi_cli_import_search_and_pricebook(tmp_path: Path, capsys):
    db=tmp_path/'db.sqlite3'; z=_archive(tmp_path)
    assert main(['import',str(db),str(z),'--competence','2026-07'])==0
    release=json.loads(capsys.readouterr().out)['release_id']
    assert main(['search',str(db),release,'--uf','SP','--query','alvenaria'])==0
    hits=json.loads(capsys.readouterr().out); assert hits[0]['code']=='1'
    mappings=tmp_path/'map.json'; mappings.write_text(json.dumps([{'composition_code':'1','ifc_class':'IfcWall','quantity_kind':'area'}]))
    out=tmp_path/'pricebook.json'
    assert main(['pricebook',str(db),release,'--uf','SP','--mappings',str(mappings),'--output',str(out)])==0
    payload=json.loads(out.read_text()); assert payload['source']=='SINAPI' and payload['compositions'][0]['base_unit_cost']==50
