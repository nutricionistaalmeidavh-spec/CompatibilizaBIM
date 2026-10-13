import pytest
from compatibilizabim.p2_workflow import P2Service
def fixture():
    rec={'source_file':'HID.ifc','discipline':'hydraulic','global_id':'GUID-1','ifc_class':'IfcPipeSegment','element_name':'Tubo','storey':'Térreo','quantity_name':'NetLength','kind':'length','value':10.,'unit':'m','source':'ifc_qto'}
    return {'schema_version':1,'records':[rec],'groups':[],'revision_sha256':{'HID.ifc':'a'*64}}
def test_p4_approved_increments_rebase_and_drafts_are_not_paid(tmp_path):
    svc=P2Service(tmp_path);svc.put_fixture_quantities(fixture())
    a=svc.execute('measure',{'guids':['GUID-1'],'period':'2026-10','percent':30,'kind':'length','quantity_name':'NetLength'})
    b=svc.execute('measure',{'guids':['GUID-1'],'period':'2026-11','percent':60,'kind':'length','quantity_name':'NetLength'})
    assert a['status']=='draft' and b['lines'][0]['delta_quantity']==6
    svc.execute('approve',{'batch_id':a['batch_id'],'approved_by':'Engenheiro QA'})
    result=svc.execute('approve',{'batch_id':b['batch_id'],'approved_by':'Engenheiro QA'})
    assert result['status']=='approved'
    batches=svc.execute('status',{})['measurements']
    assert batches[1]['lines'][0]['previous_percent']==30
    assert batches[1]['lines'][0]['delta_quantity']==3
def test_p4_reject_and_regression_guard(tmp_path):
    svc=P2Service(tmp_path);svc.put_fixture_quantities(fixture())
    a=svc.execute('measure',{'guids':['GUID-1'],'period':'2026-10','percent':50,'kind':'length','quantity_name':'NetLength'})
    with pytest.raises(ValueError,match='approved_by'):svc.execute('approve',{'batch_id':a['batch_id'],'approved_by':''})
    svc.execute('reject',{'batch_id':a['batch_id'],'reason':'Revisão pendente'})
    with pytest.raises(ValueError,match='rejeitada'):svc.execute('approve',{'batch_id':a['batch_id'],'approved_by':'QA'})
    b=svc.execute('measure',{'guids':['GUID-1'],'period':'2026-11','percent':20,'kind':'length','quantity_name':'NetLength'})
    assert b['lines'][0]['previous_percent']==0
    svc.execute('approve',{'batch_id':b['batch_id'],'approved_by':'QA'})
    with pytest.raises(ValueError,match='inferior'):svc.execute('measure',{'guids':['GUID-1'],'period':'2026-12','percent':10,'kind':'length','quantity_name':'NetLength'})
