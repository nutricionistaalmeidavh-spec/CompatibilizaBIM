from __future__ import annotations
import argparse, json
from pathlib import Path
from .measurements import MeasurementStore
from .measurement_financial import FinancialMeasurementEngine, write_financial_measurement_json, write_financial_measurement_csv, write_financial_measurement_pdf
from .schedule import ScheduleStore

def main(argv=None):
    p=argparse.ArgumentParser(prog='compatibilizabim-measurement-report',description='Valoriza medições BIM aprovadas com o orçamento 5D')
    p.add_argument('measurements',type=Path); p.add_argument('budget',type=Path); p.add_argument('--schedule',type=Path); p.add_argument('--out-dir',type=Path,required=True)
    a=p.parse_args(argv); batches=MeasurementStore(a.measurements).load(); budget=json.loads(a.budget.read_text(encoding='utf-8')); schedule=ScheduleStore(a.schedule).load() if a.schedule else None
    report=FinancialMeasurementEngine().calculate(batches,budget,schedule=schedule); a.out_dir.mkdir(parents=True,exist_ok=True)
    j=a.out_dir/'measurement-financial.json'; c=a.out_dir/'measurement-financial.csv'; pdf=a.out_dir/'measurement-financial.pdf'; write_financial_measurement_json(j,report);write_financial_measurement_csv(c,report);write_financial_measurement_pdf(pdf,report)
    print(json.dumps({'report_path':str(j),'csv_path':str(c),'pdf_path':str(pdf),'total_measured':report['total_measured'],'remaining_budget':report['remaining_budget'],'unmatched_line_count':report['unmatched_line_count']},ensure_ascii=False,indent=2)); return 0
if __name__=='__main__': raise SystemExit(main())
