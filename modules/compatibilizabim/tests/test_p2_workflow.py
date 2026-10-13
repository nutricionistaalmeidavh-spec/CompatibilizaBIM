import json
from pathlib import Path
import pytest
from compatibilizabim.p2_workflow import P2Service

def quantity_fixture():
    rec={'source_file':'HID.ifc','discipline':'hydraulic','global_id':'GUID-1','ifc_class':'IfcPipeSegment',
         'element_name':'Tubo','type_name':None,'storey':'Térreo','material':None,
         'quantity_name':'NetLength','kind':'length','value':10.0,'unit':'m','source':'ifc_qto'}
    return {'schema_version':1,'model_files':['HID.ifc'],'record_count':1,'group_count':1,'records':[rec],
            'groups':[{'discipline':'hydraulic','source':'ifc_qto','storey':'Térreo','ifc_class':'IfcPipeSegment',
              'type_name':None,'material':None,'quantity_name':'NetLength','kind':'length','unit':'m','value':10,
              'element_count':1}]}

def catalog():
    return {'schema_version':1,'currency':'BRL','source':'SINAPI importada localmente','reference_date':'2026-09',
      'provenance':{'uf':'SP','source':'SINAPI local','competencia':'2026-09'},'bdi_percent':10,
      'compositions':[{'code':'123','description':'Tubulação','unit':'m','components':[{'code':'mat','description':'Tubo','category':'material','unit':'m','coefficient':1,'unit_cost':5}]}],
      'mappings':[{'composition_code':'123','ifc_class':'IfcPipeSegment','quantity_kind':'length','quantity_name_contains':'NetLength'}]}

def test_p2_budget_from_local_pricebook_is_traceable_and_incomplete_groups_are_not_priced(tmp_path):
    svc=P2Service(tmp_path)
    svc.put_fixture_quantities(quantity_fixture())
    saved=svc.execute('pricebook',{'book':catalog()})
    assert saved['source']=='SINAPI importada localmente'
    report=svc.execute('budget',{})
    assert report['total_cost']==pytest.approx(55)
    assert report['matched_group_count']==1
    assert report['source']=='SINAPI importada localmente'
    assert (tmp_path/'budget.json').is_file()
    incomplete=catalog();incomplete['mappings']=[]
    svc.execute('pricebook',{'book':incomplete})
    new=svc.execute('budget',{})
    assert new['total_cost']==0
    assert new['unmatched_group_count']==1

def test_p2_schedule_and_two_measurements_have_no_duplicate_accounting(tmp_path):
    svc=P2Service(tmp_path);svc.put_fixture_quantities(quantity_fixture())
    svc.execute('pricebook',{'book':catalog()});svc.execute('budget',{})
    svc.execute('activity',{'activity_id':'AT-1','name':'Instalação','start_date':'2026-10-01','end_date':'2026-10-31','composition_code':'123'})
    svc.execute('link',{'activity_id':'AT-1','guids':['GUID-1']})
    at=svc.execute('simulate',{'date':'2026-10-16'})
    assert at['activities'][0]['linked_guids']==['GUID-1']
    one=svc.execute('measure',{'guids':['GUID-1'],'period':'2026-10','percent':40,'kind':'length','quantity_name':'NetLength','activity_id':'AT-1'})
    svc.execute('approve',{'batch_id':one['batch_id'],'approved_by':'Responsável técnico'})
    two=svc.execute('measure',{'guids':['GUID-1'],'period':'2026-11','percent':70,'kind':'length','quantity_name':'NetLength','activity_id':'AT-1'})
    svc.execute('approve',{'batch_id':two['batch_id'],'approved_by':'Responsável técnico'})
    rows=svc.execute('measurements',{})['batches']
    assert rows[0]['lines'][0]['delta_quantity']==pytest.approx(4)
    assert rows[1]['lines'][0]['delta_quantity']==pytest.approx(3)
    finance=svc.execute('finance',{})
    assert finance['total_measured']==pytest.approx(38.5)
    assert finance['valued_line_count']==2

def test_p2_no_untrusted_pricebook_or_out_of_model_guid(tmp_path):
    svc=P2Service(tmp_path);svc.put_fixture_quantities(quantity_fixture())
    invalid=catalog();invalid['source']=None
    with pytest.raises(ValueError,match='fonte'):svc.execute('pricebook',{'book':invalid})
    with pytest.raises(ValueError,match='GUID'):svc.execute('link',{'activity_id':'x','guids':['unknown']})

def test_p2_does_not_promote_partial_qto_as_verified(tmp_path):
    svc=P2Service(tmp_path)
    with pytest.raises(ValueError,match='quantitativos'):svc.execute('budget',{})

def test_p2_bcf_export_uses_actual_guid_and_open_issue_metadata(tmp_path):
    import base64,io,zipfile
    svc=P2Service(tmp_path)
    result=svc.execute('bcf',{'projectId':'study-a','author':'Equipe BIM','issues':[{
      'aGlobalId':'0123456789012345678901','bGlobalId':'1234567890123456789012',
      'aClasse':'IfcPipeSegment','bClasse':'IfcWall','modo':'intersection',
      'ponto':[1,2,3],'distanciaM':0.01,'origens':['HID.ifc','ARQ.ifc'],
      'status':'em_revisao','responsavel':'Coordenação'
    }]})
    assert result['format']=='BCF-3.0'
    assert result['issue_count']==1
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['base64']))) as arc:
        assert 'bcf.version' in arc.namelist()
        assert any(x.endswith('/markup.bcf') for x in arc.namelist())

def test_p2_cyclic_import_rolls_back_without_losing_existing_schedule(tmp_path):
    svc=P2Service(tmp_path)
    svc.execute('activity',{'activity_id':'BASE','name':'Base','start_date':'2026-10-01','end_date':'2026-10-07'})
    csv='activity_id,name,start_date,end_date,predecessors\nA,Um,2026-10-01,2026-10-02,B\nB,Dois,2026-10-03,2026-10-04,A\n'
    with pytest.raises(ValueError,match='cíclicas'):
        svc.execute('import_schedule',{'csv':csv})
    assert [a['activity_id'] for a in svc.execute('status',{})['activities']]==['BASE']

def test_p2_rejects_same_guid_linked_to_multiple_tasks(tmp_path):
    svc=P2Service(tmp_path);svc.put_fixture_quantities(quantity_fixture())
    for id in ('A','B'):
        svc.execute('activity',{'activity_id':id,'name':id,'start_date':'2026-10-01','end_date':'2026-10-30'})
    svc.execute('link',{'activity_id':'A','guids':['GUID-1']})
    with pytest.raises(ValueError,match='já vinculado'):
        svc.execute('link',{'activity_id':'B','guids':['GUID-1']})

def test_p2_exports_only_actual_quantity_and_budget_reports(tmp_path):
    import base64
    svc=P2Service(tmp_path);svc.put_fixture_quantities(quantity_fixture())
    book=catalog();svc.execute('pricebook',{'book':book});svc.execute('budget',{})
    data=svc.execute('export_quantities',{'format':'csv'})
    assert data['name']=='quantities.csv'
    assert b'GUID-1' in base64.b64decode(data['base64'])
    report=svc.execute('export_budget',{'format':'json'})
    parsed=json.loads(base64.b64decode(report['base64']))
    assert parsed['total_cost']==pytest.approx(55)
    assert parsed['source']==book['source']

def test_p4_qto_guid_filter_is_not_limited_by_first_800_rows(tmp_path):
    svc=P2Service(tmp_path)
    report=quantity_fixture()
    report['records']=[{**report['records'][0],'global_id':'OTHER-'+str(i)} for i in range(850)]
    report['records'].append({**quantity_fixture()['records'][0],'global_id':'GUID-TARGET'})
    report['revision_sha256']={'HID.ifc':'a'*64}
    svc.put_fixture_quantities(report)
    output=svc.execute('quantity_records',{'globalId':'GUID-TARGET'})
    assert output['total']==1
    assert output['truncated'] is False
    assert output['records'][0]['global_id']=='GUID-TARGET'
    assert output['revision_sha256']['HID.ifc']=='a'*64
    with pytest.raises(ValueError,match='GUID'):
        svc.execute('quantity_records',{'globalId':''})
