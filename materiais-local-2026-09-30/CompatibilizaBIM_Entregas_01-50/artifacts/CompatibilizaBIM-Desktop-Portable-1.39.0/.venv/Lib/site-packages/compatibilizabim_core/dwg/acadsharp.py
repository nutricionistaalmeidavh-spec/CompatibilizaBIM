from __future__ import annotations
import json, os, shutil, subprocess
from pathlib import Path
from .models import BridgePayload,DWGImportResult

class ACadSharpBridgeUnavailable(RuntimeError): pass
class ACadSharpBridgeError(RuntimeError): pass

class ACadSharpProvider:
    """Open-source native DWG provider backed by the MIT-licensed ACadSharp bridge.

    The Core communicates with the .NET bridge only through a stable JSON contract.
    No ACadSharp type leaks into Python/CBIM.
    """
    name='acadsharp'
    def __init__(self, *, bridge_executable:str|Path|None=None, bridge_project:str|Path|None=None, command:list[str]|None=None, timeout:float=120.0):
        env=os.getenv('CBIM_ACADSHARP_BRIDGE')
        self.bridge_executable=Path(bridge_executable or env).expanduser() if (bridge_executable or env) else None
        self.bridge_project=Path(bridge_project).expanduser() if bridge_project else None
        self.command=command
        self.timeout=timeout
    def available(self)->bool:
        if self.command: return True
        if self.bridge_executable: return self.bridge_executable.exists()
        return bool(self.bridge_project and self.bridge_project.exists() and shutil.which('dotnet'))
    def _argv(self,source:Path,target:Path)->list[str]:
        if self.command:
            return [p.format(source=str(source),target=str(target),project=str(self.bridge_project or ''),exe=str(self.bridge_executable or '')) for p in self.command]
        if self.bridge_executable:
            return [str(self.bridge_executable),str(source),str(target)]
        if self.bridge_project and shutil.which('dotnet'):
            return ['dotnet','run','--no-launch-profile','--project',str(self.bridge_project),'--',str(source),str(target)]
        raise ACadSharpBridgeUnavailable('ACadSharp bridge is not built/available; set CBIM_ACADSHARP_BRIDGE or provide bridge_project with dotnet installed')
    def read_result(self,source:str|Path)->DWGImportResult:
        source=Path(source)
        if source.suffix.lower()!='.dwg': raise ValueError('ACadSharpProvider expects .dwg')
        if not source.exists(): raise FileNotFoundError(source)
        import tempfile
        with tempfile.TemporaryDirectory(prefix='cbim-acadsharp-') as tmp:
            target=Path(tmp)/'payload.json'; argv=self._argv(source,target)
            proc=subprocess.run(argv,capture_output=True,text=True,check=False,timeout=self.timeout)
            if proc.returncode!=0 or not target.exists():
                raise ACadSharpBridgeError(f"ACadSharp bridge failed ({proc.returncode}): {(proc.stderr or proc.stdout).strip()}")
            try: payload=BridgePayload.model_validate_json(target.read_text(encoding='utf-8'))
            except Exception as exc: raise ACadSharpBridgeError(f'invalid ACadSharp bridge payload: {exc}') from exc
        data=payload.document.model_dump(); data['source_format']='dwg'; data['source_path']=str(source)
        data['metadata']={**data.get('metadata',{}),'dwg_provider':'acadsharp','native_dwg':True,'converted_via_dxf':False}
        doc=payload.document.model_validate(data)
        diag=payload.diagnostics.model_copy(update={'provider':'acadsharp','source_path':str(source)})
        return DWGImportResult(document=doc,diagnostics=diag,xrefs=payload.xrefs)
