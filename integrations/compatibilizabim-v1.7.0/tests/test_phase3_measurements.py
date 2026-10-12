from pathlib import Path
import pytest
from compatibilizabim.measurements import MeasurementService, MeasurementStore

REPORT={
 'schema_version':1,
 'records':[
   {'global_id':'G1','ifc_class':'IfcWall','element_name':'W1','storey':'P1','discipline':'Architecture','quantity_name':'NetArea','kind':'area','value':10.0,'unit':'m2','source':'ifc_qto'},
   {'global_id':'G2','ifc_class':'IfcWall','element_name':'W2','storey':'P1','discipline':'Architecture','quantity_name':'NetArea','kind':'area','value':20.0,'unit':'m2','source':'ifc_qto'},
 ]
}

def test_cumulative_measurement_avoids_double_count(tmp_path: Path):
    service=MeasurementService(MeasurementStore(tmp_path/'measurements.json'))
    b1=service.create_from_guids(REPORT,['G1','G2'],period='2026-09',cumulative_percent=40,quantity_kind='area',quantity_name='NetArea',contractor='Equipe A')
    assert b1.delta_by_unit['m2']==12.0
    service.approve(b1.batch_id,approved_by='Fiscal')
    b2=service.create_from_guids(REPORT,['G1','G2'],period='2026-10',cumulative_percent=70,quantity_kind='area',quantity_name='NetArea')
    assert b2.delta_by_unit['m2']==9.0
    assert all(line.previous_percent==40 for line in b2.lines)
    service.approve(b2.batch_id,approved_by='Fiscal')
    with pytest.raises(ValueError,match='inferior ao já aprovado'):
        service.create_from_guids(REPORT,['G1'],period='2026-11',cumulative_percent=60,quantity_kind='area',quantity_name='NetArea')


def test_measurement_rejects_missing_guid_and_invalid_percent(tmp_path: Path):
    service=MeasurementService(MeasurementStore(tmp_path/'measurements.json'))
    with pytest.raises(ValueError,match='nenhum quantitativo'):
        service.create_from_guids(REPORT,['NOPE'],period='2026-09',cumulative_percent=50,quantity_kind='area')
    with pytest.raises(ValueError,match='entre 0 e 100'):
        service.create_from_guids(REPORT,['G1'],period='2026-09',cumulative_percent=120,quantity_kind='area')
