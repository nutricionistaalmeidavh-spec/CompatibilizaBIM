from compatibilizabim.schedule import Activity, Schedule, ProgressEntry
from compatibilizabim.simulation4d import Simulation4D


def test_simulation_planned_actual_status_and_curve():
    schedule=Schedule((
        Activity('A1','Fundacao','2026-09-01','2026-09-05',linked_guids=('G1',),actual_progress=100,actual_finish='2026-09-05',progress_history=(ProgressEntry('2026-09-05',100),)),
        Activity('A2','Estrutura','2026-09-06','2026-09-10',predecessors=('A1',),linked_guids=('G2','G3'),actual_progress=20,actual_start='2026-09-06',progress_history=(ProgressEntry('2026-09-06',10),ProgressEntry('2026-09-08',20))),
    ))
    report=Simulation4D().build(schedule,'2026-09-08')
    by={x['activity_id']:x for x in report['activities']}
    assert by['A1']['status']=='completed'
    assert by['A2']['planned_progress']==50.0
    assert by['A2']['actual_progress']==20.0
    assert by['A2']['variance_percent']==-30.0
    assert by['A2']['status']=='late'
    assert report['state_by_guid']['G1']=='completed'
    assert report['state_by_guid']['G2']=='late'
    assert report['overall']['planned_progress'] > report['overall']['actual_progress']
    assert report['curve'][0]['date']=='2026-09-01'
    assert report['curve'][-1]['date']=='2026-09-10'


def test_simulation_rejects_invalid_date():
    schedule=Schedule((Activity('A1','X','2026-09-01','2026-09-05'),))
    try:
        Simulation4D().build(schedule,'08/09/2026')
    except ValueError as exc:
        assert 'YYYY-MM-DD' in str(exc)
    else:
        raise AssertionError('expected ValueError')
