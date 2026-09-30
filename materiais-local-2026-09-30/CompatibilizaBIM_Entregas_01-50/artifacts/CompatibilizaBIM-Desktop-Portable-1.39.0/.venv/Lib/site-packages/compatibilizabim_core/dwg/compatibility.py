from __future__ import annotations
from pathlib import Path
from pydantic import BaseModel,ConfigDict

DWG_VERSION_LABELS={'AC1014':'R14','AC1015':'2000/2000i/2002','AC1018':'2004/2005/2006','AC1021':'2007/2008/2009','AC1024':'2010/2011/2012','AC1027':'2013-2017','AC1032':'2018+'}
ACADSHARP_READABLE=set(DWG_VERSION_LABELS)

class CompatibilityResult(BaseModel):
    model_config=ConfigDict(extra='forbid')
    path:str; signature:str|None=None; label:str|None=None; declared_supported:bool=False
    attempted:bool=False; imported:bool=False; coverage:float|None=None; error:str|None=None

def inspect_dwg_signature(path:str|Path)->tuple[str|None,str|None,bool]:
    raw=Path(path).read_bytes()[:6]
    try:sig=raw.decode('ascii')
    except UnicodeDecodeError:return None,None,False
    return sig,DWG_VERSION_LABELS.get(sig),sig in ACADSHARP_READABLE

def run_compatibility_suite(paths, importer=None):
    out=[]
    for p in map(Path,paths):
        sig,label,supported=inspect_dwg_signature(p); row=CompatibilityResult(path=str(p),signature=sig,label=label,declared_supported=supported)
        if importer is not None and supported:
            row.attempted=True
            try:
                result=importer.read_result(p); row.imported=True; row.coverage=result.diagnostics.coverage
            except Exception as exc: row.error=f'{type(exc).__name__}: {exc}'
        out.append(row)
    return out
