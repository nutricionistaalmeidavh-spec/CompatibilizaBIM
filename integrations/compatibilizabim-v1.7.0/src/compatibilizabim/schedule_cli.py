from __future__ import annotations
import argparse, json
from pathlib import Path
from .schedule import ScheduleService, ScheduleStore
from .simulation4d import Simulation4D


def parser() -> argparse.ArgumentParser:
    p=argparse.ArgumentParser(prog='compatibilizabim-4d',description='Planejamento BIM 4D')
    p.add_argument('schedule', type=Path, help='Arquivo schedule.json')
    sub=p.add_subparsers(dest='command',required=True)
    sub.add_parser('list')
    imp=sub.add_parser('import'); imp.add_argument('csv',type=Path)
    add=sub.add_parser('add'); add.add_argument('activity_id'); add.add_argument('name'); add.add_argument('start_date'); add.add_argument('end_date'); add.add_argument('--predecessor',action='append',default=[]); add.add_argument('--discipline'); add.add_argument('--storey'); add.add_argument('--composition-code')
    link=sub.add_parser('link'); link.add_argument('activity_id'); link.add_argument('guids',nargs='+'); link.add_argument('--replace',action='store_true')
    prog=sub.add_parser('progress'); prog.add_argument('activity_id'); prog.add_argument('progress',type=float); prog.add_argument('--actual-start'); prog.add_argument('--actual-finish'); prog.add_argument('--recorded-on')
    sim=sub.add_parser('simulate'); sim.add_argument('date')
    return p


def main(argv=None) -> int:
    args=parser().parse_args(argv); service=ScheduleService(ScheduleStore(args.schedule))
    if args.command=='list': result=service.list_activities()
    elif args.command=='import': result=service.import_csv(args.csv)
    elif args.command=='add': result=service.add_activity(args.activity_id,args.name,args.start_date,args.end_date,predecessors=args.predecessor,discipline=args.discipline,storey=args.storey,composition_code=args.composition_code); result=service.list_activities()[-1]
    elif args.command=='link': result=service.link_elements(args.activity_id,args.guids,replace_existing=args.replace); result=service.list_activities()[[a.activity_id for a in service.store.load().activities].index(result.activity_id)]
    elif args.command=='progress': service.update_progress(args.activity_id,args.progress,actual_start=args.actual_start,actual_finish=args.actual_finish,recorded_on=args.recorded_on); result=next(x for x in service.list_activities() if x['activity_id']==args.activity_id)
    else: result=Simulation4D().build(service.store.load(),args.date)
    print(json.dumps(result,ensure_ascii=False,indent=2)); return 0

if __name__=='__main__': raise SystemExit(main())
