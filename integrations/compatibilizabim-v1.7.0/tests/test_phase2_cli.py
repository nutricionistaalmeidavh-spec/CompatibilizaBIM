from compatibilizabim.quantities_cli import build_parser as qp
from compatibilizabim.budget_cli import build_parser as bp

def test_phase2_cli_contracts():
    q=qp().parse_args(['a.ifc','--output','q.json','--csv','q.csv'])
    assert q.output.name=='q.json' and q.csv.name=='q.csv'
    b=bp().parse_args(['q.json','book.json','--output','b.json'])
    assert b.pricebook.name=='book.json' and b.output.name=='b.json'
