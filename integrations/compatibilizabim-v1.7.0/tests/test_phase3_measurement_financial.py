from compatibilizabim.measurements import MeasurementBatch, MeasurementLine
from compatibilizabim.measurement_financial import FinancialMeasurementEngine
from compatibilizabim.schedule import Activity, Schedule


def test_financial_measurement_values_approved_delta():
    batch=MeasurementBatch('MED-1','2026-09','x','Equipe A','A1','approved',(
        MeasurementLine('G1','IfcWall','W','P1','Architecture','NetArea','area','m2',10,0,50,5),
    ),approved_by='Fiscal',approved_at='x')
    budget={'currency':'BRL','total_cost':1000,'source':'SINAPI','reference_date':'2026-07','lines':[{'composition_code':'C1','description':'Alvenaria','ifc_class':'IfcWall','storey':'P1','quantity_name':'NetArea','unit':'m2','final_unit_cost':100,'total_cost':1000}]}
    schedule=Schedule((Activity('A1','Parede','2026-09-01','2026-09-30',composition_code='C1'),))
    r=FinancialMeasurementEngine().calculate((batch,),budget,schedule=schedule)
    assert r['total_measured']==500
    assert r['remaining_budget']==500
    assert r['measured_percent_of_budget']==50
    assert r['by_period']['2026-09']==500
    assert r['lines'][0]['composition_code']=='C1'
    assert r['unmatched']==[]


def test_financial_measurement_leaves_ambiguous_unpriced():
    batch=MeasurementBatch('MED-1','2026-09','x',None,None,'approved',(
        MeasurementLine('G1','IfcWall','W','P1','Architecture','NetArea','area','m2',10,0,50,5),
    ),approved_by='Fiscal',approved_at='x')
    budget={'currency':'BRL','total_cost':2000,'lines':[
        {'composition_code':'C1','description':'A','ifc_class':'IfcWall','storey':'P1','quantity_name':'NetArea','unit':'m2','final_unit_cost':100,'total_cost':1000},
        {'composition_code':'C2','description':'B','ifc_class':'IfcWall','storey':'P1','quantity_name':'NetArea','unit':'m2','final_unit_cost':120,'total_cost':1000},
    ]}
    r=FinancialMeasurementEngine().calculate((batch,),budget)
    assert r['total_measured']==0
    assert len(r['unmatched'])==1
