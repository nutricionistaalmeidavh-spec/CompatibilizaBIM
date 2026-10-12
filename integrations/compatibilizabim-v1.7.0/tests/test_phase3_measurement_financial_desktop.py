import json,time
from pathlib import Path
from compatibilizabim.desktop_service import DesktopService

def test_financial_report_desktop_job(tmp_path: Path):
    s=DesktopService(tmp_path); pid=s.create_project('Financeiro')['project_id']; project=s.projects.get_project(pid)
    s.add_schedule_activity(pid,{'activity_id':'A1','name':'Parede','start_date':'2026-09-01','end_date':'2026-09-30','composition_code':'C1'}); s.link_schedule_elements(pid,'A1',['G1'])
    q={'records':[{'global_id':'G1','ifc_class':'IfcWall','element_name':'W','storey':'P1','discipline':'Architecture','quantity_name':'NetArea','kind':'area','value':10,'unit':'m2','source':'ifc_qto'}]}; (project.path/'reports'/'quantities-JOB-X.json').write_text(json.dumps(q),encoding='utf-8')
    b=s.create_measurement(pid,{'activity_id':'A1','period':'2026-09','cumulative_percent':50,'quantity_kind':'area','quantity_name':'NetArea'}); s.approve_measurement(pid,b['batch_id'],approved_by='Fiscal')
    budget={'currency':'BRL','source':'SINAPI','reference_date':'2026-07','total_cost':1000,'lines':[{'composition_code':'C1','description':'Alvenaria','ifc_class':'IfcWall','storey':'P1','quantity_name':'NetArea','unit':'m2','final_unit_cost':100,'total_cost':1000}]}; (project.path/'reports'/'budget-JOB-Y.json').write_text(json.dumps(budget),encoding='utf-8')
    job=s.start_measurement_financial_report(pid)
    for _ in range(100):
        row=s.get_job(pid,job['job_id'])
        if row['status'] in {'completed','failed'}: break
        time.sleep(.01)
    assert row['status']=='completed'; assert row['result']['total_measured']==500
    assert Path(row['result']['pdf_path']).is_file(); assert Path(row['result']['csv_path']).is_file()
