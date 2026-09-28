import json
from pathlib import Path
from compatibilizabim.desktop_service import DesktopService


def test_desktop_measurement_from_activity(tmp_path: Path):
    s=DesktopService(tmp_path); pid=s.create_project('M')['project_id']
    s.add_schedule_activity(pid,{'activity_id':'A1','name':'Parede','start_date':'2026-09-01','end_date':'2026-09-30'}); s.link_schedule_elements(pid,'A1',['G1'])
    reports=s.projects.get_project(pid).path/'reports'; reports.mkdir(exist_ok=True)
    (reports/'quantities-JOB-X.json').write_text(json.dumps({'records':[{'global_id':'G1','ifc_class':'IfcWall','element_name':'W','storey':'P1','discipline':'Architecture','quantity_name':'NetArea','kind':'area','value':10,'unit':'m2','source':'ifc_qto'}]}),encoding='utf-8')
    b=s.create_measurement(pid,{'activity_id':'A1','period':'2026-09','cumulative_percent':50,'quantity_kind':'area','quantity_name':'NetArea','contractor':'Equipe'})
    assert b['delta_by_unit']['m2']==5
    a=s.approve_measurement(pid,b['batch_id'],approved_by='Fiscal'); assert a['status']=='approved'
    summary=s.list_measurements(pid)['summary']; assert summary['by_period']['2026-09']['m2']==5
    out=s.export_measurements_csv(pid); assert Path(out['csv_path']).is_file()
