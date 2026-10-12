from __future__ import annotations

import calendar
import csv
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Sequence

from .measurements import MeasurementBatch
from .schedule import Schedule
from .simulation4d import planned_progress


class FinancialMeasurementEngine:
    def calculate(self, batches: Sequence[MeasurementBatch], budget_report: dict[str, Any], *, schedule: Schedule | None = None) -> dict[str, Any]:
        budget_lines=[row for row in budget_report.get('lines') or [] if isinstance(row,dict)]
        activity_map={a.activity_id:a for a in (schedule.activities if schedule else ())}
        valued=[]; unmatched=[]
        by_period:dict[str,float]={}; by_contractor:dict[str,float]={}; by_composition:dict[str,float]={}
        for batch in batches:
            if batch.status!='approved': continue
            activity=activity_map.get(batch.activity_id or '')
            preferred=activity.composition_code if activity else None
            for line in batch.lines:
                candidates=self._candidates(line,budget_lines,preferred)
                unique={(str(c.get('composition_code') or ''),float(c.get('final_unit_cost') or 0.0)):c for c in candidates}
                if len(unique)!=1:
                    unmatched.append({'batch_id':batch.batch_id,'global_id':line.global_id,'quantity_name':line.quantity_name,'unit':line.unit,'reason':'sem correspondência' if not unique else 'correspondência ambígua','candidate_compositions':sorted({str(c.get('composition_code') or '') for c in candidates})})
                    continue
                (_,unit_cost),bline=next(iter(unique.items())); amount=round(line.delta_quantity*unit_cost,2); code=str(bline.get('composition_code') or '')
                row={'batch_id':batch.batch_id,'period':batch.period,'contractor':batch.contractor,'activity_id':batch.activity_id,'global_id':line.global_id,'ifc_class':line.ifc_class,'storey':line.storey,'quantity_name':line.quantity_name,'unit':line.unit,'delta_quantity':line.delta_quantity,'composition_code':code,'description':bline.get('description'),'unit_cost':unit_cost,'amount':amount}
                valued.append(row); by_period[batch.period]=round(by_period.get(batch.period,0.0)+amount,2); who=batch.contractor or 'Não informado'; by_contractor[who]=round(by_contractor.get(who,0.0)+amount,2); by_composition[code]=round(by_composition.get(code,0.0)+amount,2)
        total=round(sum(x['amount'] for x in valued),2); budget_total=float(budget_report.get('total_cost') or 0.0)
        periods=self._period_comparison(by_period,budget_lines,schedule)
        return {'schema_version':1,'generated_at':datetime.now(timezone.utc).isoformat(),'currency':str(budget_report.get('currency') or 'BRL'),'budget_source':budget_report.get('source'),'budget_reference_date':budget_report.get('reference_date'),'cost_provenance':dict(budget_report.get('cost_provenance') or {}),'budget_total':budget_total,'total_measured':total,'remaining_budget':round(budget_total-total,2),'measured_percent_of_budget':round(total/budget_total*100,2) if budget_total else 0.0,'valued_line_count':len(valued),'unmatched_line_count':len(unmatched),'lines':valued,'unmatched':unmatched,'by_period':by_period,'by_contractor':by_contractor,'by_composition':by_composition,'period_comparison':periods}

    @staticmethod
    def _candidates(line: Any, budget_lines: Sequence[dict[str,Any]], preferred: str|None) -> list[dict[str,Any]]:
        rows=[]
        for b in budget_lines:
            if preferred and str(b.get('composition_code') or '')!=preferred: continue
            if str(b.get('unit') or '')!=line.unit: continue
            if str(b.get('ifc_class') or '')!=line.ifc_class: continue
            if (b.get('storey') or None)!=(line.storey or None): continue
            if str(b.get('quantity_name') or '').casefold()!=line.quantity_name.casefold(): continue
            rows.append(b)
        return rows

    @staticmethod
    def _period_comparison(measured_by_period: dict[str,float], budget_lines:Sequence[dict[str,Any]], schedule:Schedule|None)->list[dict[str,Any]]:
        if not schedule or not measured_by_period:return []
        comp_totals:dict[str,float]={}
        for line in budget_lines:
            code=str(line.get('composition_code') or ''); comp_totals[code]=comp_totals.get(code,0.0)+float(line.get('total_cost') or 0.0)
        activities_by_comp:dict[str,list[Any]]={}
        for a in schedule.activities:
            if a.composition_code:activities_by_comp.setdefault(a.composition_code,[]).append(a)
        allocated:dict[str,float]={}
        for code,acts in activities_by_comp.items():
            total=comp_totals.get(code,0.0); weight=sum(max(1,len(a.linked_guids)) for a in acts)
            for a in acts: allocated[a.activity_id]=total*max(1,len(a.linked_guids))/weight if weight else 0.0
        result=[]; measured_cum=0.0
        for period in sorted(measured_by_period):
            measured_cum += measured_by_period[period]
            try:
                year,month=(int(x) for x in period.split('-',1)); end=date(year,month,calendar.monthrange(year,month)[1]).isoformat()
            except Exception: continue
            planned=0.0
            for a in schedule.activities: planned += allocated.get(a.activity_id,0.0)*planned_progress(a,end)/100.0
            result.append({'period':period,'planned_cumulative':round(planned,2),'measured_cumulative':round(measured_cum,2),'variance':round(measured_cum-planned,2),'variance_percent':round((measured_cum-planned)/planned*100,2) if planned else None})
        return result


def write_financial_measurement_json(path:Path,report:dict[str,Any])->None:
    path.parent.mkdir(parents=True,exist_ok=True); tmp=path.with_name(f'.{path.name}.tmp'); tmp.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(path)

def write_financial_measurement_csv(path:Path,report:dict[str,Any])->None:
    fields=['batch_id','period','contractor','activity_id','global_id','ifc_class','storey','quantity_name','unit','delta_quantity','composition_code','description','unit_cost','amount']; path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('w',newline='',encoding='utf-8-sig') as h:
        w=csv.DictWriter(h,fieldnames=fields);w.writeheader();[w.writerow({k:r.get(k) for k in fields}) for r in report.get('lines') or []]

def write_financial_measurement_pdf(path:Path,report:dict[str,Any])->None:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc: raise RuntimeError('reportlab é necessário para gerar PDF de medição') from exc
    path.parent.mkdir(parents=True,exist_ok=True); styles=getSampleStyleSheet(); currency=report.get('currency') or 'BRL'
    story=[Paragraph('CompatibilizaBIM — Medição BIM Financeira',styles['Title']),Paragraph(f"Medido aprovado: {currency} {float(report.get('total_measured') or 0):,.2f} · Orçamento: {currency} {float(report.get('budget_total') or 0):,.2f} · Avanço financeiro: {float(report.get('measured_percent_of_budget') or 0):.2f}%",styles['Heading2']),Paragraph(f"Fonte de custos: {report.get('budget_source') or '-'} · Referência: {report.get('budget_reference_date') or '-'}",styles['BodyText']),Spacer(1,10)]
    data=[['Período','Lote','Composição','Elemento','Qtd.','Un.','Custo un.','Valor']]
    for r in report.get('lines') or []:data.append([r.get('period'),r.get('batch_id'),r.get('composition_code'),r.get('global_id'),f"{float(r.get('delta_quantity') or 0):,.2f}",r.get('unit'),f"{float(r.get('unit_cost') or 0):,.2f}",f"{float(r.get('amount') or 0):,.2f}"])
    table=Table(data,repeatRows=1,colWidths=[55,80,65,90,55,35,65,75]);table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#333333')),('TEXTCOLOR',(0,0),(-1,0),colors.white),('FONTSIZE',(0,0),(-1,-1),7),('GRID',(0,0),(-1,-1),.25,colors.grey),('VALIGN',(0,0),(-1,-1),'TOP')]))
    story.append(table)
    if report.get('period_comparison'):
        story += [Spacer(1,12),Paragraph('Previsto × medido',styles['Heading2'])]
        pdata=[['Período','Previsto acum.','Medido acum.','Desvio']]+[[x['period'],f"{x['planned_cumulative']:,.2f}",f"{x['measured_cumulative']:,.2f}",f"{x['variance']:,.2f}"] for x in report['period_comparison']]
        pt=Table(pdata,colWidths=[80,100,100,100]);pt.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.25,colors.grey),('FONTSIZE',(0,0),(-1,-1),8)]));story.append(pt)
    SimpleDocTemplate(str(path),pagesize=landscape(A4),leftMargin=24,rightMargin=24,topMargin=24,bottomMargin=24).build(story)
