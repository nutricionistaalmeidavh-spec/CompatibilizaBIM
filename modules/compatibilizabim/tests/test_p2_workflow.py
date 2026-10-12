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
