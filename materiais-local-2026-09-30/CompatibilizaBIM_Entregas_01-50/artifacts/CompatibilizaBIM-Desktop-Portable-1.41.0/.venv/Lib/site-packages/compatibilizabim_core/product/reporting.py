from __future__ import annotations
import html,json
from pathlib import Path
from cbim_sdk import CBIMProject
from ..quantities import QuantityCalculator
from .models import ConversionReport,ImportPlan

def build_conversion_report(project:CBIMProject,*,import_plan:ImportPlan|None=None,confidence_threshold:float=.8)->ConversionReport:
    states={};conf=[]
    for e in project.elements:
        states[e.review_state]=states.get(e.review_state,0)+1;conf.append(e.confidence)
    total=len(project.elements);low=sum(1 for c in conf if c<confidence_threshold)
    pending=sum(states.get(k,0) for k in ('auto',)) + states.get('rejected',0)
    accepted=states.get('confirmed',0)+states.get('edited',0)
    q=QuantityCalculator().calculate(project)
    warnings=[];blockers=[]
    if low:warnings.append(f'{low} elements below {confidence_threshold:.0%} confidence')
    if states.get('rejected',0):blockers.append(f"{states['rejected']} rejected elements remain")
    if states.get('auto',0):blockers.append(f"{states['auto']} automatic elements still require review")
    if import_plan and not import_plan.ready:blockers.extend(import_plan.warnings)
    completion=accepted/total if total else 1.0
    return ConversionReport(project_id=project.id,project_name=project.name,source_files=len(import_plan.enabled_sources()) if import_plan else 0,element_counts=project.element_counts(),total_elements=total,review_states=states,mean_confidence=sum(conf)/len(conf) if conf else 1.0,low_confidence=low,pending_review=pending,confirmed_or_edited=accepted,completion_rate=completion,quantity_totals=q.totals_by_type,warnings=warnings,blockers=blockers,ready_to_export=not blockers)

def report_html(report:ConversionReport)->str:
    data=report.model_dump(mode='json')
    rows=''.join(f'<tr><td>{html.escape(k)}</td><td>{v}</td></tr>' for k,v in sorted(report.element_counts.items()))
    blockers=''.join(f'<li>{html.escape(x)}</li>' for x in report.blockers) or '<li>Nenhum bloqueio</li>'
    warnings=''.join(f'<li>{html.escape(x)}</li>' for x in report.warnings) or '<li>Nenhum aviso</li>'
    status='PRONTO PARA EXPORTAR' if report.ready_to_export else 'REVISÃO NECESSÁRIA'
    return f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Conversão - {html.escape(report.project_name)}</title><style>body{{font-family:system-ui;max-width:1000px;margin:40px auto;padding:0 24px;color:#17202a}}.hero{{display:flex;justify-content:space-between;gap:20px;align-items:end;border-bottom:2px solid #e5e7eb;padding-bottom:24px}}.status{{font-weight:800}}.grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}}.card{{border:1px solid #e5e7eb;border-radius:12px;padding:16px}}.big{{font-size:28px;font-weight:800}}table{{border-collapse:collapse;width:100%}}td,th{{padding:9px;border-bottom:1px solid #eee;text-align:left}}code{{font-size:12px}}</style></head><body><div class=hero><div><h1>Relatório de Conversão</h1><div>{html.escape(report.project_name)}</div></div><div class=status>{status}</div></div><div class=grid><div class=card><div class=big>{report.total_elements}</div>Elementos</div><div class=card><div class=big>{report.mean_confidence:.0%}</div>Confiança média</div><div class=card><div class=big>{report.completion_rate:.0%}</div>Revisado</div><div class=card><div class=big>{report.pending_review}</div>Pendências</div></div><h2>Elementos</h2><table><tr><th>Tipo</th><th>Quantidade</th></tr>{rows}</table><h2>Bloqueios</h2><ul>{blockers}</ul><h2>Avisos</h2><ul>{warnings}</ul><details><summary>JSON do relatório</summary><pre><code>{html.escape(json.dumps(data,indent=2,ensure_ascii=False))}</code></pre></details></body></html>'''

def write_report(report:ConversionReport,path:str|Path)->Path:
    p=Path(path);p.write_text(report_html(report),encoding='utf-8');return p
