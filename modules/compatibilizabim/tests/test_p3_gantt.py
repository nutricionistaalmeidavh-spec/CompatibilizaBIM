from pathlib import Path
import pytest
from compatibilizabim.p2_workflow import P2Service

def create(svc,id,name,start,end,predecessors=None):
    return svc.execute('activity',{'activity_id':id,'name':name,'start_date':start,'end_date':end,
                                    'predecessors':predecessors or []})

def test_p3_reschedule_persists_dates_and_validates_dependency_graph(tmp_path):
    svc=P2Service(tmp_path)
    create(svc,'A','Fundação','2026-10-01','2026-10-05')
    create(svc,'B','Concretagem','2026-10-07','2026-10-10',['A'])
    result=svc.execute('reschedule',{'activity_id':'A','start_date':'2026-10-01','end_date':'2026-10-06'})
    assert result['end_date']=='2026-10-06'
    assert svc.execute('status',{})['activities'][0]['end_date']=='2026-10-06'
    with pytest.raises(ValueError,match='Dependência violada'):
        svc.execute('reschedule',{'activity_id':'A','start_date':'2026-10-02','end_date':'2026-10-08'})
    with pytest.raises(ValueError,match='cíclicas'):
        svc.execute('reschedule',{'activity_id':'A','start_date':'2026-10-01','end_date':'2026-10-06','predecessors':['B']})
    with pytest.raises(ValueError,match='Predecessora inexistente'):
        svc.execute('reschedule',{'activity_id':'B','start_date':'2026-10-11','end_date':'2026-10-12','predecessors':['NONEXISTENT']})
    assert svc.execute('status',{})['activities'][0]['end_date']=='2026-10-06'
    assert svc.execute('status',{})['activities'][1]['predecessors']==['A']

def test_p3_progress_history_keeps_date_and_does_not_approve_measurements(tmp_path):
    svc=P2Service(tmp_path)
    create(svc,'A','Instalação','2026-10-01','2026-10-30')
    svc.execute('progress',{'activity_id':'A','progress':35,'recorded_on':'2026-10-14'})
    svc.execute('progress',{'activity_id':'A','progress':50,'recorded_on':'2026-10-16'})
    activity=svc.execute('status',{})['activities'][0]
    assert len(activity['progress_history'])==2
    assert activity['actual_progress']==50
    assert svc.execute('simulate',{'date':'2026-10-14'})['activities'][0]['actual_progress']==35
    assert svc.execute('status',{})['measurements']==[]

def test_p3_complete_ifc_guid_search_paginates_beyond_truncated_qto(tmp_path):
    svc=P2Service(tmp_path)
    report={'schema_version':1,'records':[{
        'global_id':f'GUID-{i:04d}','source_file':'ARQ.ifc','element_name':'Parede estrutural',
        'ifc_class':'IfcWall','storey':'Térreo','source':'ifc_qto'
    } for i in range(1100)],'groups':[], 'revision_sha256':{'ARQ.ifc':'b'*64}}
    report['records'].append({'global_id':'GUID-EXCLUÍDO','source_file':'ARQ.ifc','source':'geometry_fallback','element_name':'Sem QTO'})
    svc.put_fixture_quantities(report)
    result=svc.execute('guid_lookup',{'search':'GUID-1000','limit':40})
    assert result['total']==1
    assert result['entries'][0]['global_id']=='GUID-1000'
    assert result['revision_sha256']['ARQ.ifc']=='b'*64
    page=svc.execute('guid_lookup',{'search':'Parede','limit':40,'offset':1080})
    assert page['total']==1100 and len(page['entries'])==20
    assert not any(row['global_id']=='GUID-EXCLUÍDO' for row in svc.execute('guid_lookup',{'search':'GUID-','limit':60})['entries'])
    with pytest.raises(ValueError,match='2 caracteres'):
        svc.execute('guid_lookup',{'search':'a'})
