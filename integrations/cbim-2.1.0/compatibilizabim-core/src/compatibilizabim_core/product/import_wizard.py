from __future__ import annotations
import re
from pathlib import Path
from .models import ImportPlan,ImportSource,ProjectConfiguration,ProductDiscipline,SourceFormat
from ..levels import LevelDefinition

EXACT_PATTERNS={
'architecture':{'ARQ','PLANTA','LAYOUT'},
'structure':{'ESTR','CONCRETO','FORMA','FORMAS'},
'hydraulic':{'HID','HIDR','AGUA','ÁGUA','ESGOTO','SANIT','PLUV','AF','AQ'},
'fire':{'INC','FIRE','SPRINK','HIDRANTE','SPK'},
}
PREFIX_PATTERNS={
'architecture':('ARQUIT','ARCH'),
'structure':('ESTRUT','STRUCT'),
'hydraulic':('HIDRAUL','ESGOT','SANIT','PLUV'),
'fire':('INCEND','SPRINK'),
}

def detect_discipline(name:str)->tuple[ProductDiscipline,str]:
    tokens=[token for token in re.split(r'[^A-Z0-9ÁÉÍÓÚ]+',name.upper()) if token]
    hits=[discipline for discipline in EXACT_PATTERNS if any(
        token in EXACT_PATTERNS[discipline] or token.startswith(PREFIX_PATTERNS[discipline])
        for token in tokens
    )]
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
