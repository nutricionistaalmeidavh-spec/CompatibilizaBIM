from __future__ import annotations
import re
from pathlib import Path
from .models import ImportPlan,ImportSource,ProjectConfiguration,ProductDiscipline,SourceFormat
from ..levels import LevelDefinition

PATTERNS={
'architecture':('ARQ','ARQUIT','ARCH','PLANTA','LAYOUT'),
'structure':('ESTR','EST_','STRUCT','CONCRETO','FORMA'),
'hydraulic':('HID','HIDR','AGUA','ÁGUA','ESGOTO','SANIT','PLUV','AF_','AQ_'),
'fire':('INC','FIRE','SPRINK','HIDRANTE','SPK'),
}

def detect_discipline(name:str)->tuple[ProductDiscipline,str]:
    token=re.sub(r'[^A-Z0-9ÁÉÍÓÚ_]+','_',name.upper())
    hits=[d for d,patterns in PATTERNS.items() if any(p in token for p in patterns)]
    if len(hits)==1:return hits[0],'filename'
    return 'unknown','ambiguous' if hits else 'unmatched'

def detect_format(path:str|Path)->SourceFormat:
    p=str(path).lower()
    if p.endswith('.cbim.json'):return 'cbim'
    suffix=Path(path).suffix.lower()
    if suffix in {'.dwg','.dxf','.ifc'}: return suffix[1:]
    raise ValueError(f'Unsupported source format: {path}')

def build_import_plan(paths:list[str|Path],config:ProjectConfiguration|None=None,discipline_overrides:dict[str,ProductDiscipline]|None=None)->ImportPlan:
    config=config or ProjectConfiguration(); discipline_overrides=discipline_overrides or {}
    sources=[];warnings=[];seen=set()
    for raw in paths:
        p=Path(raw);key=str(p).casefold()
        if key in seen:
            warnings.append(f'Duplicate source ignored: {p}')
            continue
        seen.add(key)
        fmt=detect_format(p)
        disc,reason=detect_discipline(p.stem)
        if str(p) in discipline_overrides:disc=discipline_overrides[str(p)];reason='override'
        sw=[]
        if disc=='unknown':sw.append('Discipline requires confirmation')
        if fmt=='ifc':sw.append('IFC will enter through the CBIM bridge rather than CAD recognition')
        sources.append(ImportSource(path=str(p),name=p.name,discipline=disc,source_format=fmt,detected_by=reason,warnings=sw))
    enabled=[s for s in sources if s.enabled]
    if not enabled:warnings.append('At least one source is required')
    unknown=[s.name for s in enabled if s.discipline=='unknown']
    if unknown:warnings.append('Confirm discipline for: '+', '.join(unknown))
    ready=bool(enabled) and not unknown
    return ImportPlan(config=config,sources=sources,warnings=warnings,ready=ready)

def levels_from_config(config:ProjectConfiguration)->list[LevelDefinition]:
    return [LevelDefinition(s.name,s.elevation,s.height) for s in config.storeys]
