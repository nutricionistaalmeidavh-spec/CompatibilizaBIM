from __future__ import annotations
import re
from ..cad.model import CadEntity, CadInsert

_EXPLICIT_DIAM = re.compile(r'(?:DN|DIA(?:M)?|Ø)\s*[-_ ]?\s*(\d{2,4})(?:\s*MM)?', re.IGNORECASE)
_TRAILING_NUMBER = re.compile(r'(?:^|[_\- ])(\d{2,4})$')


def tagged(text: str, *tokens: str) -> bool:
    up=text.upper(); return any(t.upper() in up for t in tokens)


def diameter_m_with_source(entity: CadEntity, default_mm: float) -> tuple[float,str]:
    values=[entity.layer]+[str(v) for k,v in entity.metadata.items() if 'diam' in k.lower() or 'dn' in k.lower()]
    if isinstance(entity,CadInsert): values.append(entity.block_name)
    for value in values:
        m=_EXPLICIT_DIAM.search(value.replace('_',' '))
        if m:
            n=float(m.group(1))
            if 10 <= n <= 2000: return n/1000.0,'explicit_token'
    # In observed blocks such as H-U-AF-TB_COR0900_20, the final token is the nominal diameter.
    if isinstance(entity,CadInsert):
        m=_TRAILING_NUMBER.search(entity.block_name)
        if m:
            n=float(m.group(1))
            if 10 <= n <= 2000: return n/1000.0,'block_suffix'
    val=entity.metadata.get('default_diameter_mm') or entity.metadata.get('default_diameter')
    if isinstance(val,(int,float)) and val>0:
        return (float(val)/1000.0 if float(val)>2 else float(val)),'profile_default'
    return default_mm/1000.0,'recognizer_default'


def diameter_m(entity: CadEntity, default_mm: float) -> float:
    return diameter_m_with_source(entity,default_mm)[0]


def fitting_type_from_label(label:str)->tuple[str,float|None]:
    up=label.upper()
    if any(t in up for t in ('TEE','TÊ','_TE_')): return 'tee',None
    if any(t in up for t in ('COR090','JOELHO','ELBOW','CURVA 90','CURVA90')): return 'elbow',90.0
    if any(t in up for t in ('COR045','CURVA 45','CURVA45')): return 'elbow',45.0
    if 'REDUC' in up: return 'reducer',None
    if any(t in up for t in ('LUVA','COUPLING')): return 'coupling',None
    if any(t in up for t in ('CRUZ','CROSS')): return 'cross',None
    if any(t in up for t in ('CAP','TAMPA')): return 'cap',None
    return 'other',None
