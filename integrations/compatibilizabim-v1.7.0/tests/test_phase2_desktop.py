from __future__ import annotations
import json, time
from pathlib import Path
from compatibilizabim.desktop_service import DesktopService

VALID_IFC=b"ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"

def wait(s,p,j):
    for _ in range(200):
        x=s.get_job(p,j)
        if x['status'] in {'completed','failed'}: return x
        time.sleep(.01)
    raise AssertionError('timeout')

def test_desktop_quantities_and_5d_budget_flow(tmp_path: Path):
    def qr(paths,jout,cout,fallback,ctx):
        report={"schema_version":1,"groups":[{"discipline":"Architecture","storey":"Térreo","ifc_class":"IfcWall","type_name":"14cm","material":None,"quantity_name":"NetArea","kind":"area","unit":"m2","value":10,"element_count":2}],"record_count":2,"group_count":1}
        jout.write_text(json.dumps(report)); cout.write_text('csv'); return {'record_count':2,'group_count':1}
    def br(qpath,bpath,jout,cout,pout,ctx):
        report={"total_cost":1200.0,"currency":"BRL","matched_group_count":1,"unmatched_group_count":0,"lines":[]}
        jout.write_text(json.dumps(report)); cout.write_text('csv'); pout.write_bytes(b'%PDF-1.4 fake'); return report
    s=DesktopService(tmp_path/'data',quantities_runner=qr,budget_runner=br)
    p=s.create_project('P'); s.import_model_bytes(p['project_id'],'arc.ifc',VALID_IFC)
    q=wait(s,p['project_id'],s.start_quantities(p['project_id'])['job_id'])
    assert q['status']=='completed' and q['result']['group_count']==1
    book={"currency":"BRL","bdi_percent":0,"compositions":[{"code":"ALV","description":"Alvenaria","unit":"m2","components":[{"code":"X","description":"X","category":"material","unit":"m2","coefficient":1,"unit_cost":100}]}],"mappings":[{"composition_code":"ALV","ifc_class":"IfcWall","quantity_kind":"area"}]}
    s.save_pricebook(p['project_id'],book)
    b=wait(s,p['project_id'],s.start_budget(p['project_id'])['job_id'])
    assert b['status']=='completed' and b['result']['total_cost']==1200
    assert Path(b['result']['report_path']).is_file()
