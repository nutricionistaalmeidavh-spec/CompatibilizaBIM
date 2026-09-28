from __future__ import annotations
import argparse, json
from pathlib import Path
from .budget import BudgetEngine, PriceBookStore, write_budget_csv, write_budget_json, write_budget_pdf


def build_parser():
    p=argparse.ArgumentParser(prog='compatibilizabim-budget',description='Gera orçamento 5D a partir de quantitativos BIM e catálogo de custos.')
    p.add_argument('quantities',type=Path); p.add_argument('pricebook',type=Path)
    p.add_argument('--output',type=Path,default=Path('budget.json')); p.add_argument('--csv',type=Path,default=None); p.add_argument('--pdf',type=Path,default=None)
    return p

def main(argv=None):
    a=build_parser().parse_args(argv)
    q=json.loads(a.quantities.read_text(encoding='utf-8')); book=PriceBookStore(a.pricebook).load()
    report=BudgetEngine().calculate(q,book); write_budget_json(a.output,report)
    if a.csv: write_budget_csv(a.csv,report)
    if a.pdf: write_budget_pdf(a.pdf,report)
    print(f"Orçamento: {report['currency']} {report['total_cost']:.2f} · {report['matched_group_count']} grupos precificados -> {a.output}")
    return 0

if __name__=='__main__': raise SystemExit(main())
