from __future__ import annotations
import argparse, json
from pathlib import Path
from .measurements import MeasurementService, MeasurementStore, write_measurement_csv


def parser():
    p=argparse.ArgumentParser(prog='compatibilizabim-measurements',description='Medição física BIM cumulativa')
    p.add_argument('store',type=Path); sub=p.add_subparsers(dest='command',required=True)
    sub.add_parser('list')
    c=sub.add_parser('create'); c.add_argument('quantity_report',type=Path); c.add_argument('--period',required=True); c.add_argument('--percent',type=float,required=True); c.add_argument('--kind',required=True); c.add_argument('--quantity-name'); c.add_argument('--guid',action='append',required=True); c.add_argument('--contractor'); c.add_argument('--activity-id')
    a=sub.add_parser('approve'); a.add_argument('batch_id'); a.add_argument('--by',required=True,dest='approved_by')
    r=sub.add_parser('reject'); r.add_argument('batch_id'); r.add_argument('--reason',required=True)
    e=sub.add_parser('export'); e.add_argument('csv',type=Path)
    return p

def main(argv=None):
    args=parser().parse_args(argv); service=MeasurementService(MeasurementStore(args.store))
    if args.command=='list': result={'batches':service.list_batches()}
    elif args.command=='create':
        report=json.loads(args.quantity_report.read_text(encoding='utf-8')); b=service.create_from_guids(report,args.guid,period=args.period,cumulative_percent=args.percent,quantity_kind=args.kind,quantity_name=args.quantity_name,contractor=args.contractor,activity_id=args.activity_id); result=next(x for x in service.list_batches() if x['batch_id']==b.batch_id)
    elif args.command=='approve': service.approve(args.batch_id,approved_by=args.approved_by); result=next(x for x in service.list_batches() if x['batch_id']==args.batch_id)
    elif args.command=='reject': service.reject(args.batch_id,reason=args.reason); result=next(x for x in service.list_batches() if x['batch_id']==args.batch_id)
    else: write_measurement_csv(args.csv,service.store.load()); result={'csv_path':str(args.csv),'batch_count':len(service.store.load())}
    print(json.dumps(result,ensure_ascii=False,indent=2)); return 0

if __name__=='__main__': raise SystemExit(main())
