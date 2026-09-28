from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any
from .schedule import Activity, Schedule


def _parse(value: str) -> date:
    try: return date.fromisoformat(str(value))
    except ValueError as exc: raise ValueError('Data da simulação deve usar YYYY-MM-DD') from exc


def planned_progress(activity: Activity, on_date: str) -> float:
    current=_parse(on_date); start=_parse(activity.start_date); end=_parse(activity.end_date)
    if current < start: return 0.0
    if current >= end: return 100.0
    total=max(1,(end-start).days); elapsed=(current-start).days
    return round(max(0.0,min(100.0,elapsed/total*100.0)),2)


def actual_progress_on(activity: Activity, on_date: str) -> float:
    current=_parse(on_date); candidates=[x for x in activity.progress_history if _parse(x.recorded_on) <= current]
    if candidates: return float(candidates[-1].progress)
    # Backwards compatibility for schedules created before progress history existed.
    if not activity.progress_history and activity.actual_start and _parse(activity.actual_start) <= current:
        return float(activity.actual_progress)
    return 0.0


def activity_status(activity: Activity, on_date: str, *, tolerance_percent: float=5.0) -> str:
    current=_parse(on_date); start=_parse(activity.start_date); end=_parse(activity.end_date)
    actual=actual_progress_on(activity,on_date); planned=planned_progress(activity,on_date)
    if actual >= 100: return 'completed'
    if current < start and actual <= 0: return 'not_started'
    if current > end and actual < 100: return 'late'
    if actual + tolerance_percent < planned: return 'late'
    if actual > 0: return 'in_progress'
    return 'planned'


class Simulation4D:
    def build(self, schedule: Schedule, on_date: str) -> dict[str, Any]:
        current=_parse(on_date); activities=[]; state_by_guid={}; weighted_plan=weighted_actual=weight_total=0.0
        for activity in schedule.activities:
            planned=planned_progress(activity,on_date); actual=actual_progress_on(activity,on_date); status=activity_status(activity,on_date)
            weight=float(max(1,len(activity.linked_guids))); weighted_plan+=planned*weight; weighted_actual+=actual*weight; weight_total+=weight
            activities.append({'activity_id':activity.activity_id,'name':activity.name,'start_date':activity.start_date,'end_date':activity.end_date,'planned_progress':planned,'actual_progress':actual,'variance_percent':round(actual-planned,2),'status':status,'linked_guids':list(activity.linked_guids),'discipline':activity.discipline,'storey':activity.storey,'composition_code':activity.composition_code,'weight':weight})
            for guid in activity.linked_guids: state_by_guid[guid]=status
        overall={'planned_progress':round(weighted_plan/weight_total,2) if weight_total else 0.0,'actual_progress':round(weighted_actual/weight_total,2) if weight_total else 0.0}
        overall['variance_percent']=round(overall['actual_progress']-overall['planned_progress'],2)
        return {'schema_version':2,'date':current.isoformat(),'activities':activities,'state_by_guid':state_by_guid,'overall':overall,'curve':self.curve(schedule)}

    def curve(self, schedule: Schedule) -> list[dict[str, Any]]:
        if not schedule.activities:return []
        start=min(_parse(a.start_date) for a in schedule.activities); end=max(_parse(a.end_date) for a in schedule.activities); points=[]; cursor=start
        while cursor<=end:
            day=cursor.isoformat(); total=planned=actual=0.0
            for a in schedule.activities:
                w=float(max(1,len(a.linked_guids))); total+=w; planned+=planned_progress(a,day)*w; actual+=actual_progress_on(a,day)*w
            points.append({'date':day,'planned_progress':round(planned/total,2) if total else 0.0,'actual_progress':round(actual/total,2) if total else 0.0,'variance_percent':round((actual-planned)/total,2) if total else 0.0})
            cursor+=timedelta(days=1)
        return points

    def timeline(self, schedule: Schedule, *, max_points: int=120) -> list[dict[str, Any]]:
        if not schedule.activities:return []
        start=min(_parse(a.start_date) for a in schedule.activities); end=max(_parse(a.end_date) for a in schedule.activities)
        days=(end-start).days; step=max(1,math.ceil(max(1,days)/max(1,max_points-1)))
        dates=[]; cursor=start
        while cursor<=end:
            dates.append(cursor); cursor+=timedelta(days=step)
        if dates[-1]!=end:dates.append(end)
        result=[]
        for d in dates:
            snapshot=self.build_without_curve(schedule,d.isoformat()); result.append({'date':d.isoformat(),'state_by_guid':snapshot['state_by_guid'],'overall':snapshot['overall']})
        return result

    def build_without_curve(self, schedule: Schedule, on_date: str) -> dict[str, Any]:
        current=_parse(on_date); states={}; plan=actual=total=0.0
        for a in schedule.activities:
            w=float(max(1,len(a.linked_guids))); total+=w; plan+=planned_progress(a,on_date)*w; actual+=actual_progress_on(a,on_date)*w
            status=activity_status(a,on_date)
            for guid in a.linked_guids:states[guid]=status
        overall={'planned_progress':round(plan/total,2) if total else 0.0,'actual_progress':round(actual/total,2) if total else 0.0}
        overall['variance_percent']=round(overall['actual_progress']-overall['planned_progress'],2)
        return {'date':current.isoformat(),'state_by_guid':states,'overall':overall}
