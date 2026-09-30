from __future__ import annotations
import shutil, subprocess, tempfile
from pathlib import Path
from typing import Protocol
from ..cad.dxf import DXFImporter
from ..cad.model import CadDocument
from .models import DWGImportDiagnostics,DWGImportResult

class DWGBackendUnavailable(RuntimeError): pass
class DWGProvider(Protocol):
    name: str
    def available(self) -> bool: ...

class ExternalDWGConverter:
    """Legacy adapter for external engines that convert DWG to DXF."""
    def __init__(self, executable: str, command: list[str] | None = None, name: str = "external-dwg"):
        self.executable=executable; self.command=command or ["{exe}","{source}","{target}"]; self.name=name
    def available(self)->bool: return bool(shutil.which(self.executable) or Path(self.executable).exists())
    def to_dxf(self, source: Path, target: Path)->None:
        if not self.available(): raise DWGBackendUnavailable(f"DWG provider '{self.name}' is not available: {self.executable}")
        argv=[p.format(exe=self.executable,source=str(source),target=str(target)) for p in self.command]
        proc=subprocess.run(argv,capture_output=True,text=True,check=False)
        if proc.returncode != 0 or not target.exists(): raise RuntimeError(f"DWG provider '{self.name}' failed ({proc.returncode}): {proc.stderr.strip()}")

class DWGImporter:
    def __init__(self, provider: DWGProvider, *, dxf_importer: DXFImporter | None=None): self.provider=provider; self.dxf_importer=dxf_importer or DXFImporter()
    def read_result(self,path:str|Path)->DWGImportResult:
        source=Path(path)
        if source.suffix.lower() != '.dwg': raise ValueError('DWGImporter expects a .dwg file')
        if not self.provider.available(): raise DWGBackendUnavailable(f"DWG provider '{self.provider.name}' is unavailable")
        direct=getattr(self.provider,'read_result',None)
        if callable(direct): return direct(source)
        to_dxf=getattr(self.provider,'to_dxf',None)
        if not callable(to_dxf): raise DWGBackendUnavailable(f"DWG provider '{self.provider.name}' exposes neither read_result nor to_dxf")
        with tempfile.TemporaryDirectory(prefix='cbim-dwg-') as tmp:
            dxf=Path(tmp)/f'{source.stem}.dxf'; to_dxf(source,dxf); document=self.dxf_importer.read(dxf)
        data=document.model_dump(); data['source_id']=f"dwg:{source.name}:{document.source_id.rsplit(':',1)[-1]}"; data['source_format']='dwg'; data['source_path']=str(source)
        metadata=dict(document.metadata); metadata.update({'dwg_provider':self.provider.name,'converted_via_dxf':True,'native_dwg':False}); data['metadata']=metadata
        doc=CadDocument.model_validate(data)
        by_kind={}
        for e in doc.entities: by_kind[e.kind]=by_kind.get(e.kind,0)+1
        diag=DWGImportDiagnostics(provider=self.provider.name,source_path=str(source),total_entities=len(doc.entities),converted_entities=len(doc.entities),by_canonical_kind=by_kind,warnings=['legacy DWG provider converted through DXF; native entity diagnostics unavailable'])
        return DWGImportResult(document=doc,diagnostics=diag)
    def read(self,path:str|Path)->CadDocument: return self.read_result(path).document
