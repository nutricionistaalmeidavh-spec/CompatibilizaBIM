from pathlib import Path

import pytest

from compatibilizabim.schedule import ScheduleService, ScheduleStore


def test_schedule_import_link_progress_and_roundtrip(tmp_path: Path):
    path = tmp_path / 'schedule.json'
    csv_path = tmp_path / 'schedule.csv'
    csv_path.write_text(
        'activity_id,name,start_date,end_date,predecessors\n'
        'A1,Fundações,2026-09-01,2026-09-05,\n'
        'A2,Estrutura P1,2026-09-06,2026-09-12,A1\n',
        encoding='utf-8',
    )
    service = ScheduleService(ScheduleStore(path))
    result = service.import_csv(csv_path)
    assert result['imported'] == 2
    service.link_elements('A2', ['GUID-B', 'GUID-A', 'GUID-A'])
    service.update_progress('A2', 35.0, actual_start='2026-09-07')

    payload = ScheduleStore(path).load()
    assert [a.activity_id for a in payload.activities] == ['A1', 'A2']
    a2 = payload.activities[1]
    assert a2.predecessors == ('A1',)
    assert a2.linked_guids == ('GUID-A', 'GUID-B')
    assert a2.actual_progress == 35.0
    assert a2.actual_start == '2026-09-07'


def test_schedule_rejects_invalid_dependency_and_dates(tmp_path: Path):
    service = ScheduleService(ScheduleStore(tmp_path / 'schedule.json'))
    with pytest.raises(ValueError, match='data final'):
        service.add_activity('A1', 'Estrutura', '2026-09-10', '2026-09-05')
    service.add_activity('A1', 'Estrutura', '2026-09-01', '2026-09-05')
    with pytest.raises(ValueError, match='predecessora'):
        service.add_activity('A2', 'Alvenaria', '2026-09-06', '2026-09-10', predecessors=['MISSING'])
