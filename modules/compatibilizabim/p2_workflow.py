"""P2 React/Electron adapter to the existing 4D, 5D, IFC QTO and BCF engines.

Input/output is JSON; authoritative study files remain under documents/Engenharia360/BIM/studies.
This adapter never invents prices, geometric quantities or payment status.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import math
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

from .budget import BudgetEngine, PriceBookStore, pricebook_from_json, write_budget_json, write_budget_csv, write_budget_pdf
from .ifc_backend import IfcOpenShellBackend
from .quantities import QuantityEngine, quantity_report, write_quantity_json, write_quantity_csv
from .schedule import ScheduleService, ScheduleStore
from .simulation4d import Simulation4D
from .measurements import MeasurementService, MeasurementStore
from .measurement_financial import FinancialMeasurementEngine
from .issues import IssueService, IssueStore
from .exports import ExportService


def _read(path: Path):
    if not path.is_file():
        raise ValueError('Não existem '+({'quantities.json':'quantitativos IFC','budget.json':'orçamento 5D'}.get(path.name,path.stem))+' validados neste estudo.')
    return json.loads(path.read_text(encoding='utf-8'))


def _date(s):
    try: return date.fromisoformat(str(s))
    except ValueError as exc: raise ValueError('Data deve usar YYYY-MM-DD') from exc


def _finite(value, field, *, minimum=0, maximum=1e15):
    try: n=float(value)
    except (ValueError, TypeError) as exc: raise ValueError(field + ' inválido') from exc
    if not math.isfinite(n) or n < minimum or n > maximum:
        raise ValueError(field + ' deve ser finito e estar no intervalo permitido')
    return n


class P2Service:
    def __init__(self, root: Path):
        self.root=Path(root).resolve()
        self.root.mkdir(parents=True,exist_ok=True)
        self.qpath=self.root/'quantities.json'
        self.bpath=self.root/'budget.json'
        self.pricepath=self.root/'pricebook.json'
        self.schedule=ScheduleService(ScheduleStore(self.root/'schedule.json'))
        self.measure=MeasurementService(MeasurementStore(self.root/'measurements.json'))

    def put_fixture_quantities(self, report):
        """For regression fixtures only; production extraction uses IfcOpenShell."""
        write_quantity_json(self.qpath,report)

    def _quantities(self):
        return _read(self.qpath)

    def _known_guids(self):
        return {str(row.get('global_id')) for row in self._quantities().get('records',[]) if row.get('global_id')}

    def execute(self, action: str, params: dict):
        if not isinstance(params,dict):raise ValueError('Parâmetros inválidos')
        if action=='status':
            return {'quantities':self._summary(self.qpath),'budget':self._summary(self.bpath),
                    'pricebook':self._summary(self.pricepath),
                    'activities':self.schedule.list_activities(),
                    'measurements':self.measure.list_batches()}
        if action=='quantity_records':
            q=self._quantities()
            return {'records':q.get('records',[])[:800],'groups':q.get('groups',[])[:800],
                    'total':len(q.get('records',[])),'truncated':len(q.get('records',[]))>800,
                    'revision_sha256':q.get('revision_sha256',{})}
        if action=='budget_report':
            return _read(self.bpath)
        if action=='quantities':
            paths=[]
            for name in params.get('files',[]):
                if not isinstance(name,str) or '/' in name or '\\' in name or not name.endswith('.ifc'):
                    raise ValueError('Fonte IFC fora do diretório autorizado')
                p=(self.root/'sources'/name).resolve()
                if p.parent != (self.root/'sources') or not p.is_file():raise ValueError('Fonte IFC não encontrada')
                paths.append(p)
            if not paths:raise ValueError('Informe fontes IFC originais para os quantitativos')
            records=QuantityEngine(IfcOpenShellBackend()).extract(paths,geometry_fallback=bool(params.get('allowGeometryFallback',False)))
            # GlobalID collision between two model sources can double-count physical quantities.
            provenance={}
            for row in records:
                prior=provenance.setdefault(row.global_id,row.source_file)
                if prior!=row.source_file:raise ValueError('GUID IFC repetido em fontes distintas: '+row.global_id+'. Corrija a federação antes de quantificar.')
            report=quantity_report(records,model_files=[p.name for p in paths])
            report['revision_sha256']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
            if self.qpath.exists() and _read(self.qpath).get('revision_sha256')!=report['revision_sha256']:
                if self.measure.store.load():
                    raise ValueError('Versão IFC alterada com medições existentes. Preserve o estudo e crie uma revisão de medição antes de reextrair.')
            write_quantity_json(self.qpath,report)
            return {'record_count':report['record_count'],'group_count':report['group_count'],
                    'records':report.get('records',[])[:600],'groups':report.get('groups',[])[:600],
                    'truncated':len(report.get('records',[]))>600,'revision_sha256':report['revision_sha256']}
        if action=='export_quantities':
            return self._export_report(self._quantities(), params, 'quantities', write_quantity_csv, None)
        if action=='pricebook':
            book=params.get('book')
            if not isinstance(book,dict) or not str(book.get('source') or '').strip() or not str(book.get('reference_date') or '').strip():
                raise ValueError('Catálogo sem fonte e competência; preços sem fonte não são permitidos.')
            _finite(book.get('bdi_percent',0),'BDI',maximum=200)
            for comp in book.get('compositions',[]):
                if not str(comp.get('code') or '') or not str(comp.get('unit') or ''):
                    raise ValueError('Composição sem código ou unidade')
                _finite(comp.get('waste_percent',0),'Perdas',maximum=100)
                if not comp.get('components'):raise ValueError('Composição sem insumos não pode produzir custo')
                for component in comp['components']:
                    _finite(component.get('coefficient'),'Coeficiente')
                    _finite(component.get('unit_cost'),'Preço unitário')
            validated=pricebook_from_json(book)
            PriceBookStore(self.pricepath).save(validated)
            return {'source':validated.source,'reference_date':validated.reference_date,
                    'composition_count':len(validated.compositions),'currency':validated.currency}
        if action=='budget':
            q=self._quantities()
            if not q.get('records') or not q.get('groups'):raise ValueError('Sem quantitativos IFC reais para gerar orçamento.')
            book=PriceBookStore(self.pricepath).load()
            if not book.source or not book.reference_date:raise ValueError('Informe tabela de custos com fonte e competência explícitas.')
            report=BudgetEngine().calculate(q,book)
            report['quantity_revision_sha256']=q.get('revision_sha256',{})
            write_budget_json(self.bpath,report)
            return report
        if action=='export_budget':
            return self._export_report(_read(self.bpath), params, 'budget', write_budget_csv, write_budget_pdf)
        if action=='import_schedule':
            raw=str(params.get('csv') or '')
            if not raw or len(raw)>2_000_000:raise ValueError('CSV de cronograma vazio ou maior que 2 MB')
            previous=self.schedule.store.load()
            try:
                with tempfile.TemporaryDirectory(prefix='p2-csv-',dir=self.root) as d:
                    p=Path(d)/'schedule.csv';p.write_text(raw,encoding='utf-8')
                    result=self.schedule.import_csv(p)
                self._check_schedule()
            except Exception:
                self.schedule.store.save(previous)
                raise
            return result
        if action=='activity':
            a=self.schedule.add_activity(str(params.get('activity_id','')),str(params.get('name','')),
               str(params.get('start_date','')),str(params.get('end_date','')),
               predecessors=params.get('predecessors',[]),discipline=params.get('discipline'),
               storey=params.get('storey'),composition_code=params.get('composition_code'))
            return {'activity_id':a.activity_id}
        if action=='link':
            guids=list(params.get('guids') or [])
            if not guids or not set(guids).issubset(self._known_guids()):
                raise ValueError('GUID não encontrado nos quantitativos IFC deste estudo; o vínculo não foi gravado.')
            for a in self.schedule.store.load().activities:
                if a.activity_id != str(params.get('activity_id','')) and set(guids).intersection(a.linked_guids):
                    raise ValueError('GUID já vinculado à atividade '+a.activity_id+'; um objeto não pode ter dois estados físicos simultâneos.')
            a=self.schedule.link_elements(str(params.get('activity_id','')),guids,
                  replace_existing=bool(params.get('replace',False)))
            return {'activity_id':a.activity_id,'linked_guids':list(a.linked_guids)}
        if action=='progress':
            a=self.schedule.update_progress(str(params.get('activity_id','')),
               _finite(params.get('progress'),'Progresso',maximum=100),recorded_on=params.get('recorded_on'),
               actual_start=params.get('actual_start'),actual_finish=params.get('actual_finish'))
            return {'activity_id':a.activity_id,'actual_progress':a.actual_progress}
        if action=='simulate':
            return Simulation4D().build(self.schedule.store.load(),_date(params.get('date')).isoformat())
        if action=='measurements':
            return {'batches':self.measure.list_batches()}
        if action=='measure':
            q=self._quantities()
            batch=self.measure.create_from_guids(q,list(params.get('guids') or []),
                period=str(params.get('period','')),cumulative_percent=_finite(params.get('percent'),'Avanço acumulado',maximum=100),
                quantity_kind=str(params.get('kind','')),quantity_name=params.get('quantity_name'),
                activity_id=params.get('activity_id'),contractor=params.get('contractor'),
                allow_geometry_fallback=False)
            return next(b for b in self.measure.list_batches() if b['batch_id']==batch.batch_id)
        if action=='approve':
            b=self.measure.approve(str(params.get('batch_id','')),approved_by=str(params.get('approved_by','')))
            return {'batch_id':b.batch_id,'status':b.status,'approved_by':b.approved_by,'approved_at':b.approved_at}
        if action=='reject':
            b=self.measure.reject(str(params.get('batch_id','')),reason=str(params.get('reason','')))
            return {'batch_id':b.batch_id,'status':b.status,'reason':b.rejected_reason}
        if action=='finance':
            return FinancialMeasurementEngine().calculate(
                self.measure.store.load(),_read(self.bpath),schedule=self.schedule.store.load())
        if action=='bcf':
            return self._export_bcf(params)
        raise ValueError('Operação P2 não reconhecida: '+str(action))

    def _export_report(self, report, params, prefix, csv_writer, pdf_writer):
        fmt=str(params.get('format') or 'csv')
        if fmt not in ('json','csv','pdf') or (fmt=='pdf' and pdf_writer is None):
            raise ValueError('Formato de relatório indisponível')
        with tempfile.TemporaryDirectory(prefix='p2-export-', dir=self.root) as d:
            target=Path(d)/(prefix+'.'+fmt)
            if fmt=='json':
                target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
            elif fmt=='csv':
                csv_writer(target,report)
            else:
                pdf_writer(target,report)
            raw=target.read_bytes()
            if len(raw)>5_000_000: raise ValueError('Relatório excede 5 MB: divida o estudo para exportar.')
            return {'name':prefix+'.'+fmt,'base64':base64.b64encode(raw).decode('ascii'),
                    'format':fmt,'bytes':len(raw)}

    def _summary(self,p):
        if not p.is_file():return None
        d=_read(p)
        return {'source':d.get('source'),'reference_date':d.get('reference_date'),
                'record_count':d.get('record_count'),'total_cost':d.get('total_cost'),
                'generated_at':d.get('generated_at'),'revision_sha256':d.get('revision_sha256'),
                'matched_group_count':d.get('matched_group_count'),'unmatched_group_count':d.get('unmatched_group_count')}

    def _check_schedule(self):
        activities=self.schedule.store.load().activities
        graph={a.activity_id:set(a.predecessors) for a in activities}
        def visit(n,stack,done):
            if n in stack:raise ValueError('Cronograma contém dependências cíclicas')
            if n in done:return
            for p in graph[n]:
                if p not in graph:raise ValueError('Predecessora ausente: '+p)
                visit(p,stack|{n},done)
            done.add(n)
        done=set()
        for n in graph:visit(n,set(),done)

    def _export_bcf(self, params):
        rows=params.get('issues')
        if not isinstance(rows,list):raise ValueError('Informe as pendências canônicas do estudo.')
        if len(rows)>2000:raise ValueError('BCF limitado a 2000 pendências por pacote')
        author=str(params.get('author') or '').strip()
        if not author:raise ValueError('Informe o autor da exportação BCF.')
        project_id=str(params.get('projectId') or '').strip()
        if not project_id:raise ValueError('Estudo BIM sem identidade')
        with tempfile.TemporaryDirectory(prefix='p2-bcf-',dir=self.root) as d:
            base=Path(d); store=base/'issues.json'
            service=IssueService()
            # Preserve originating IFC GUIDs, statuses and comments through the existing IssueStore.
            for index,row in enumerate(rows):
                a,b=list(row.get('origens') or ['modelo-a.ifc','modelo-b.ifc'])[:2]
                report={'file_a':a,'file_b':b,'clashes':[{
                  'rule_id':row.get('modo','intersection'),
                  'rule_name':'Compatibilização BIM','severity':row.get('severidade','high'),
                  'a_global_id':row.get('aGlobalId',''),'b_global_id':row.get('bGlobalId',''),
                  'a_ifc_class':row.get('aClasse',''),'b_ifc_class':row.get('bClasse',''),
                  'a_name':row.get('aNome'),'b_name':row.get('bNome'),
                  'point':row.get('ponto',[0,0,0]),'depth_m':row.get('distanciaM',0)
                }]}
                rp=base/f'issue-{index}.json';rp.write_text(json.dumps(report),encoding='utf-8')
                previous={i.source_key for i in IssueStore(store).load()}
                service.import_rule_report(rp,store,project_id=project_id)
                new=[i for i in IssueStore(store).load() if i.source_key not in previous]
                if new:
                    issue=new[0]
                    status={'aberto':'open','em_revisao':'in_review','resolvido':'resolved','ignorado':'ignored'}.get(row.get('status','aberto'),'open')
                    service.update_issue(store,issue.issue_id,status=status,
                        assignee=row.get('responsavel'),due_date=row.get('prazo'),
                        ignored_reason=row.get('motivo') if status=='ignored' else None)
                    for comment in row.get('comentarios',[]):
                        service.add_comment(store,issue.issue_id,author=comment.get('autor') or author,text=comment.get('texto') or '')
            fmt=str(params.get('format') or 'bcf')
            if fmt not in ('bcf','csv','pdf'): raise ValueError('Formato de pendências deve ser BCF, CSV ou PDF')
            path=base/('issues.'+fmt)
            service_export=ExportService()
            if fmt=='bcf': summary=service_export.write_bcf(store,path,author=author)
            elif fmt=='csv': summary=service_export.write_csv(store,path)
            else: summary=service_export.write_pdf(store,path,author=author)
            encoded=base64.b64encode(path.read_bytes()).decode('ascii')
            if len(encoded)>7_000_000:raise ValueError('BCF grande demais para transferência IPC; exporte por partes')
            return {'name':'compatibiliza-'+project_id+'.'+fmt,'base64':encoded,
                    'issue_count':summary.issue_count,'format':'BCF-3.0' if fmt=='bcf' else fmt}


def main(argv=None):
    p=argparse.ArgumentParser(description='P2 IFC/QTO/4D/5D offline-first local processor')
    p.add_argument('study',type=Path);p.add_argument('action')
    p.add_argument('--request',type=Path,required=True)
    a=p.parse_args(argv)
    try:
        raw=json.loads(a.request.read_text(encoding='utf-8'))
        result=P2Service(a.study).execute(a.action,raw)
        print(json.dumps({'ok':True,'result':result},ensure_ascii=False,default=str))
        return 0
    except (ValueError,KeyError,TypeError,OSError) as exc:
        print(json.dumps({'ok':False,'error':str(exc)},ensure_ascii=False))
        return 3

if __name__=='__main__':
    raise SystemExit(main())
