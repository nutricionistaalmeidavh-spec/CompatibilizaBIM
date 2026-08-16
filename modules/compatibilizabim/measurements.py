from __future__ import annotations

import csv
import json
import uuid
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp=path.with_name(f'.{path.name}.tmp')
    tmp.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8'); tmp.replace(path)


@dataclass(frozen=True, slots=True)
class MeasurementLine:
    global_id: str
    ifc_class: str
    element_name: str | None
    storey: str | None
    discipline: str | None
    quantity_name: str
    kind: str
    unit: str
    total_quantity: float
    previous_percent: float
    cumulative_percent: float
    delta_quantity: float

    @property
    def key(self) -> str:
        return f'{self.global_id}|{self.kind}|{self.quantity_name}|{self.unit}'


@dataclass(frozen=True, slots=True)
class MeasurementBatch:
    batch_id: str
    period: str
    measured_on: str
    contractor: str | None
    activity_id: str | None
    status: str
    lines: tuple[MeasurementLine, ...]
    notes: str | None = None
    approved_by: str | None = None
    approved_at: str | None = None
    rejected_reason: str | None = None

    @property
    def delta_by_unit(self) -> dict[str,float]:
        totals: dict[str,float]={}
        for line in self.lines: totals[line.unit]=round(totals.get(line.unit,0.0)+line.delta_quantity,9)
        return totals


class MeasurementStore:
    SCHEMA_VERSION=1
    def __init__(self,path:Path)->None:self.path=Path(path)
    def load(self)->tuple[MeasurementBatch,...]:
        if not self.path.exists(): return ()
        payload=json.loads(self.path.read_text(encoding='utf-8'))
        if payload.get('schema_version')!=self.SCHEMA_VERSION: raise ValueError('Versão de medições não suportada')
        return tuple(_batch_from_json(row) for row in payload.get('batches') or [])
    def save(self,batches:Sequence[MeasurementBatch])->None:
        _atomic(self.path,{'schema_version':self.SCHEMA_VERSION,'updated_at':_now(),'batches':[_batch_json(x) for x in batches]})


class MeasurementService:
    def __init__(self,store:MeasurementStore)->None:self.store=store

    def list_batches(self)->list[dict[str,Any]]:
        return [_batch_json(x)|{'delta_by_unit':x.delta_by_unit} for x in self.store.load()]

    def create_from_guids(self, quantity_report:dict[str,Any], guids:Sequence[str], *, period:str, cumulative_percent:float, quantity_kind:str, quantity_name:str|None=None, contractor:str|None=None, activity_id:str|None=None, notes:str|None=None, allow_geometry_fallback:bool=False)->MeasurementBatch:
        percent=float(cumulative_percent)
        if percent<0 or percent>100: raise ValueError('Percentual cumulativo deve ficar entre 0 e 100')
        if not str(period).strip(): raise ValueError('Período é obrigatório')
        wanted={str(g).strip() for g in guids if str(g).strip()}
        if not wanted: raise ValueError('Informe ao menos um GUID IFC')
        rows=quantity_report.get('records')
        if not isinstance(rows,list): raise ValueError('Relatório de quantitativos inválido')
        approved=self._approved_percentages()
        lines=[]; seen=set()
        for row in rows:
            if not isinstance(row,dict): continue
            guid=str(row.get('global_id') or '')
            if guid not in wanted or str(row.get('kind') or '')!=quantity_kind: continue
            if quantity_name and str(row.get('quantity_name') or '').casefold()!=str(quantity_name).casefold(): continue
            if str(row.get('source') or '')=='geometry_fallback' and not allow_geometry_fallback: continue
            unit=str(row.get('unit') or ''); qname=str(row.get('quantity_name') or quantity_kind); key=f'{guid}|{quantity_kind}|{qname}|{unit}'
            if key in seen: continue
            seen.add(key); previous=float(approved.get(key,0.0))
            if percent+1e-9<previous: raise ValueError(f'Percentual {percent:.2f}% é inferior ao já aprovado ({previous:.2f}%) para {guid}')
            total=float(row.get('value') or 0.0); delta=total*(percent-previous)/100.0
            lines.append(MeasurementLine(guid,str(row.get('ifc_class') or ''),_text(row.get('element_name')),_text(row.get('storey')),_text(row.get('discipline')),qname,quantity_kind,unit,total,previous,percent,round(delta,9)))
        if not lines: raise ValueError('nenhum quantitativo compatível encontrado para os GUIDs/filtro informados')
        batch=MeasurementBatch('MED-'+uuid.uuid4().hex[:12].upper(),str(period).strip(),_now(),_text(contractor),_text(activity_id),'draft',tuple(lines),_text(notes))
        batches=self.store.load(); self.store.save(batches+(batch,)); return batch

    def approve(self,batch_id:str,*,approved_by:str)->MeasurementBatch:
        approver=str(approved_by).strip()
        if not approver: raise ValueError('approved_by é obrigatório')
        batches=list(self.store.load()); idx=_find_batch(batches,batch_id); batch=batches[idx]
        if batch.status=='approved': return batch
        if batch.status=='rejected': raise ValueError('Medição rejeitada não pode ser aprovada')
        approved=self._approved_percentages(exclude=batch.batch_id); new_lines=[]
        for line in batch.lines:
            previous=float(approved.get(line.key,0.0))
            if line.cumulative_percent+1e-9<previous: raise ValueError(f'Medição ficou inferior ao já aprovado para {line.global_id}')
            delta=line.total_quantity*(line.cumulative_percent-previous)/100.0
            new_lines.append(replace(line,previous_percent=previous,delta_quantity=round(delta,9)))
        updated=replace(batch,status='approved',lines=tuple(new_lines),approved_by=approver,approved_at=_now(),rejected_reason=None)
        batches[idx]=updated; self.store.save(batches); return updated

    def reject(self,batch_id:str,*,reason:str)->MeasurementBatch:
        reason=str(reason).strip()
        if not reason: raise ValueError('Motivo da rejeição é obrigatório')
        batches=list(self.store.load()); idx=_find_batch(batches,batch_id); batch=batches[idx]
        if batch.status=='approved': raise ValueError('Medição aprovada não pode ser rejeitada')
        updated=replace(batch,status='rejected',rejected_reason=reason); batches[idx]=updated; self.store.save(batches); return updated

    def _approved_percentages(self,*,exclude:str|None=None)->dict[str,float]:
        result:dict[str,float]={}
        for batch in self.store.load():
            if batch.batch_id==exclude or batch.status!='approved': continue
            for line in batch.lines: result[line.key]=max(result.get(line.key,0.0),line.cumulative_percent)
        return result


def measurement_summary(batches:Sequence[MeasurementBatch])->dict[str,Any]:
    by_period:dict[str,dict[str,float]]={}; by_contractor:dict[str,dict[str,float]]={}
    for batch in batches:
        if batch.status!='approved': continue
        for unit,value in batch.delta_by_unit.items():
            by_period.setdefault(batch.period,{})[unit]=round(by_period.setdefault(batch.period,{}).get(unit,0.0)+value,9)
            who=batch.contractor or 'Não informado'; by_contractor.setdefault(who,{})[unit]=round(by_contractor.setdefault(who,{}).get(unit,0.0)+value,9)
    return {'schema_version':1,'approved_batch_count':sum(1 for b in batches if b.status=='approved'),'by_period':by_period,'by_contractor':by_contractor}


def write_measurement_csv(path:Path,batches:Sequence[MeasurementBatch])->None:
    path.parent.mkdir(parents=True,exist_ok=True); fields=['batch_id','period','status','contractor','activity_id','global_id','ifc_class','storey','quantity_name','kind','unit','total_quantity','previous_percent','cumulative_percent','delta_quantity']
    with path.open('w',newline='',encoding='utf-8-sig') as h:
        w=csv.DictWriter(h,fieldnames=fields);w.writeheader()
        for b in batches:
            for line in b.lines:
                row={'batch_id':b.batch_id,'period':b.period,'status':b.status,'contractor':b.contractor,'activity_id':b.activity_id,**asdict(line)};w.writerow({k:row.get(k) for k in fields})


def _find_batch(batches:Sequence[MeasurementBatch],batch_id:str)->int:
    for i,b in enumerate(batches):
        if b.batch_id==batch_id:return i
    raise KeyError(f'Medição não encontrada: {batch_id}')

def _batch_json(batch:MeasurementBatch)->dict[str,Any]:
    payload=asdict(batch); payload['lines']=[asdict(x) for x in batch.lines]; return payload

def _batch_from_json(row:dict[str,Any])->MeasurementBatch:
    lines=tuple(MeasurementLine(**{k:v for k,v in x.items() if k in MeasurementLine.__dataclass_fields__}) for x in row.get('lines') or [])
    return MeasurementBatch(str(row.get('batch_id') or ''),str(row.get('period') or ''),str(row.get('measured_on') or ''),_text(row.get('contractor')),_text(row.get('activity_id')),str(row.get('status') or 'draft'),lines,_text(row.get('notes')),_text(row.get('approved_by')),_text(row.get('approved_at')),_text(row.get('rejected_reason')))
def _text(v:Any)->str|None:
    if v is None:return None
    t=str(v).strip();return t or None
