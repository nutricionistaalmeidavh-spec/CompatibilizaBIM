import json
from compatibilizabim.schedule_cli import main

def test_4d_cli_add_and_list(tmp_path,capsys):
    path=tmp_path/'schedule.json'
    assert main([str(path),'add','A1','Estrutura','2026-09-01','2026-09-05'])==0
    capsys.readouterr()
    assert main([str(path),'list'])==0
    rows=json.loads(capsys.readouterr().out)
    assert rows[0]['activity_id']=='A1'
