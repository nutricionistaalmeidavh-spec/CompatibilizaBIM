from pathlib import Path

from compatibilizabim.desktop_service import DesktopService


def test_desktop_schedule_flow(tmp_path: Path):
    service = DesktopService(tmp_path)
    p = service.create_project('Obra 4D')
    pid = p['project_id']
    a = service.add_schedule_activity(pid, {
        'activity_id':'A1','name':'Estrutura P1','start_date':'2026-09-01','end_date':'2026-09-10'
    })
    assert a['activity_id'] == 'A1'
    service.link_schedule_elements(pid, 'A1', ['G2','G1'])
    service.update_schedule_progress(pid, 'A1', 50, actual_start='2026-09-02')
    rows = service.list_schedule(pid)
    assert rows[0]['linked_guids'] == ['G1','G2']
    assert rows[0]['actual_progress'] == 50.0


def test_desktop_import_schedule_csv(tmp_path: Path):
    service = DesktopService(tmp_path)
    pid = service.create_project('CSV')['project_id']
    content = b'activity_id,name,start_date,end_date,predecessors\nA1,Fundacao,2026-09-01,2026-09-05,\n'
    result = service.import_schedule_csv_bytes(pid, 'cronograma.csv', content)
    assert result['imported'] == 1
    assert service.list_schedule(pid)[0]['name'] == 'Fundacao'
