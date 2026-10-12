import json
from compatibilizabim.measurements_cli import main

def test_measurement_cli_create_approve(tmp_path,capsys):
    q=tmp_path/'q.json'; q.write_text(json.dumps({'records':[{'global_id':'G1','ifc_class':'IfcWall','element_name':'W','storey':'P1','discipline':'Architecture','quantity_name':'NetArea','kind':'area','value':10,'unit':'m2','source':'ifc_qto'}]}),encoding='utf-8')
    store=tmp_path/'m.json'; assert main([str(store),'create',str(q),'--period','2026-09','--percent','50','--kind','area','--quantity-name','NetArea','--guid','G1'])==0
    b=json.loads(capsys.readouterr().out); assert b['delta_by_unit']['m2']==5
    assert main([str(store),'approve',b['batch_id'],'--by','Fiscal'])==0
    a=json.loads(capsys.readouterr().out); assert a['status']=='approved'

def test_measurement_html_controls():
    from compatibilizabim.desktop_html import DESKTOP_HTML
    assert 'Medição BIM' in DESKTOP_HTML and 'med-create' in DESKTOP_HTML and 'med-approver' in DESKTOP_HTML
