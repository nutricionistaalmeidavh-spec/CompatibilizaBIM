from pathlib import Path
from compatibilizabim.desktop_service import DesktopService


def test_simulation_desktop_and_viewer_job_contract(tmp_path: Path):
    # viewer runner avoids IfcOpenShell in this unit test
    def viewer(paths,max_elements,ctx):
        return {'version':1,'origin':[0,0,0],'bounds':{'minimum':[0,0,0],'maximum':[1,1,1]},'disciplines':['Structure'],'elements':[{'global_id':'G1','ifc_class':'IfcWall','name':'X','discipline':'Structure','source_file':'x.ifc','vertices':[0,0,0,1,0,0,0,1,0],'triangles':[0,1,2],'bounds':{'minimum':[0,0,0],'maximum':[1,1,0]}}],'clashes':[]}
    s=DesktopService(tmp_path,viewer_runner=viewer); pid=s.create_project('4D')['project_id']
    # add a tiny valid IFC so the viewer job has a model
    s.import_model_bytes(pid,'x.ifc',b"ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n",discipline='Structure')
    s.add_schedule_activity(pid,{'activity_id':'A1','name':'X','start_date':'2026-09-01','end_date':'2026-09-05'})
    s.link_schedule_elements(pid,'A1',['G1']); s.update_schedule_progress(pid,'A1',20,recorded_on='2026-09-03')
    sim=s.get_4d_simulation(pid,'2026-09-03'); assert sim['state_by_guid']['G1'] in {'late','in_progress'}
    job=s.start_4d_viewer(pid)
    import time
    for _ in range(100):
        row=s.get_job(pid,job['job_id'])
        if row['status'] in {'completed','failed'}: break
        time.sleep(.01)
    assert row['status']=='completed'
    html=Path(row['result']['viewer_path']).read_text(encoding='utf-8')
    assert 'Planejamento 4D' in html and 'timeline' in html and 'G1' in html
