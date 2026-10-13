"""Bounded IFC model lookup, backed by real stored IFC bytes (no geometry inference).

Only sources already used for a verified QTO revision are eligible. This
module never changes IFC, quantities, cost, schedule, measurement or audit files.
"""
from __future__ import annotations
import hashlib
import re
from pathlib import Path

_FILENAME=re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,120}\.ifc$',re.I)
_CLASS=re.compile(r'^Ifc[A-Za-z0-9]{2,62}$')

def _int_option(value,name,minimum,maximum):
    if isinstance(value,bool) or not isinstance(value,int) or not minimum<=value<=maximum:
        raise ValueError(name+' fora do intervalo autorizado')
    return value

def query_ifc(study:Path,quantities:dict,params:dict):
    filename=params.get('file')
    if not isinstance(filename,str) or not _FILENAME.fullmatch(filename) or '..' in filename:
        raise ValueError('Nome de fonte IFC inválido')
    allowed=quantities.get('revision_sha256') or {}
    if not isinstance(allowed,dict) or filename not in allowed or filename not in quantities.get('model_files',[]):
        raise ValueError('Fonte IFC não pertence à revisão QTO validada deste estudo')
    source_dir=(Path(study).resolve()/'sources').resolve()
    source=(source_dir/filename).resolve()
    if source.parent!=source_dir or not source.is_file() or source.is_symlink():
        raise ValueError('Fonte IFC original indisponível no diretório do estudo')
    if source.stat().st_size>64*1024*1024:
        raise ValueError('Consulta IFC limitada a arquivos de 64 MiB')
    digest=hashlib.sha256(source.read_bytes()).hexdigest()
    if digest!=allowed[filename]:
        raise ValueError('Fonte IFC mudou de revisão; reextraia QTO antes de consultar')
    ifc_class=params.get('ifc_class') or 'IfcElement'
    if not isinstance(ifc_class,str) or not _CLASS.fullmatch(ifc_class):
        raise ValueError('Classe IFC inválida')
    search=params.get('text') or ''
    if not isinstance(search,str) or len(search)>120:
        raise ValueError('Texto de pesquisa IFC inválido')
    limit=_int_option(params.get('limit',50),'Limite',1,100)
    offset=_int_option(params.get('offset',0),'Deslocamento',0,5000)
    try:
        import ifcopenshell  # type: ignore
    except ImportError as exc:
        raise ValueError('IfcOpenShell indisponível no runtime local') from exc
    try:
        model=ifcopenshell.open(str(source))
        elements=model.by_type(ifc_class)
    except (RuntimeError,ValueError,TypeError) as exc:
        raise ValueError('Não foi possível consultar a classe IFC no modelo original') from exc
    needle=search.strip().casefold()
    rows=[]
    matched=0
    for element in elements:
        def plain(key):
            value=getattr(element,key,None)
            return str(value or '')[:240]
        row={'guid':plain('GlobalId'),'ifc_class':str(element.is_a())[:80],
             'name':plain('Name'),'description':plain('Description'),
             'object_type':plain('ObjectType')}
        if needle and not any(needle in value.casefold() for value in row.values()):
            continue
        if offset<=matched<offset+limit:rows.append(row)
        matched+=1
    return {'source':'ifcopenshell_real','read_only':True,'model_file':filename,
            'revision_sha256':digest,'ifc_class':ifc_class,'matched_count':matched,
            'offset':offset,'limit':limit,'truncated':matched>offset+len(rows),'rows':rows}
