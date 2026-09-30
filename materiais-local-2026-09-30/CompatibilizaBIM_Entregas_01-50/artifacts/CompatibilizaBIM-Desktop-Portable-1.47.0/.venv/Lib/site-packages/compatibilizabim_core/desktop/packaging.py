from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path


def _sha(path:Path)->str:return hashlib.sha256(path.read_bytes()).hexdigest()


def build_portable_desktop_bundle(output_dir:str|Path,wheels:list[str|Path],*,version:str)->Path:
    """Create a distributable desktop bootstrap bundle.

    This is intentionally a portable Python bootstrap rather than pretending to be a
    native Windows installer. It contains the product wheels plus launch/install scripts.
    A later Windows build pipeline can wrap the same CLI into MSI/EXE without changing Core.
    """
    out=Path(output_dir);shutil.rmtree(out,ignore_errors=True);(out/'wheels').mkdir(parents=True)
    wheel_entries=[]
    for item in wheels:
        src=Path(item);dst=out/'wheels'/src.name;shutil.copy2(src,dst);wheel_entries.append({'file':f'wheels/{src.name}','sha256':_sha(dst)})
    (out/'launch.py').write_text("""from compatibilizabim_core.desktop.cli import main\nif __name__=='__main__': main()\n""",encoding='utf-8')
    (out/'install_windows.ps1').write_text(r'''$ErrorActionPreference = "Stop"
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install --find-links wheels cbim-sdk compatibilizabim-core
Write-Host "CompatibilizaBIM instalado. Use launch_windows.bat <workspace>"
''',encoding='utf-8')
    (out/'launch_windows.bat').write_text('@echo off\r\n.venv\\Scripts\\python.exe launch.py serve %*\r\n',encoding='utf-8')
    (out/'build_bridge_windows.ps1').write_text(r'''$ErrorActionPreference = "Stop"
$dotnet = "C:\Program Files\dotnet\dotnet.exe"
if (-not (Test-Path $dotnet)) { $dotnet = (Get-Command dotnet -ErrorAction Stop).Source }
$project = Join-Path $PSScriptRoot "bridge-source\CompatibilizaBIM.ACadSharpBridge.csproj"
& $dotnet restore $project
& $dotnet build $project -c Release
$exe = Join-Path $PSScriptRoot "bridge-source\bin\Release\net8.0\CompatibilizaBIM.ACadSharpBridge.exe"
Write-Host "ACadSharp bridge compilado: $exe"
''',encoding='utf-8')
    (out/'validate_hydraulic_windows.ps1').write_text(r'''param(
  [Parameter(Mandatory=$true)][string]$Dwg,
  [string]$Output = "cbim-real-dwg-result"
)
$ErrorActionPreference = "Stop"
$bridge = Join-Path $PSScriptRoot "bridge-source\bin\Release\net8.0\CompatibilizaBIM.ACadSharpBridge.exe"
if (-not (Test-Path $bridge)) { throw "Bridge nao compilado. Rode .\build_bridge_windows.ps1 primeiro." }
$cli = Join-Path $PSScriptRoot ".venv\Scripts\cbim-validate-dwg.exe"
& $cli --hydraulic $Dwg --bridge-exe $bridge --output $Output
''',encoding='utf-8')
    (out/'install_linux.sh').write_text("""#!/usr/bin/env bash
set -e
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install --find-links wheels cbim-sdk compatibilizabim-core
echo 'CompatibilizaBIM instalado. Use ./launch_linux.sh <workspace>'
""",encoding='utf-8')
    (out/'launch_linux.sh').write_text("""#!/usr/bin/env bash
set -e
.venv/bin/python launch.py serve "$@"
""",encoding='utf-8')
    for f in ('install_linux.sh','launch_linux.sh'): (out/f).chmod(0o755)
    readme=f'''# CompatibilizaBIM Desktop Portable {version}

Este pacote inicia a interface local do CompatibilizaBIM sobre um workspace persistente.

## Windows
1. Execute `install_windows.ps1` uma vez.
2. Para DWG nativo, execute `build_bridge_windows.ps1` uma vez.
3. Execute `launch_windows.bat CAMINHO_DO_WORKSPACE`.
4. Para validar um DWG hidráulico real: `./validate_hydraulic_windows.ps1 -Dwg C:\\caminho\\arquivo.dwg -Output C:\\tmp\\resultado`.

## Linux/macOS
1. Execute `./install_linux.sh` uma vez.
2. Execute `./launch_linux.sh CAMINHO_DO_WORKSPACE`.

Observação: este é o pacote desktop portável validado nesta entrega; MSI/EXE assinado é uma etapa de distribuição específica de Windows.
'''
    (out/'README.md').write_text(readme,encoding='utf-8')
    manifest={'product':'CompatibilizaBIM Desktop Portable','version':version,'wheels':wheel_entries,'entrypoint':'cbim-desktop','native_installer':False}
    (out/'package-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    return out
