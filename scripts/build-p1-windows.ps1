# Build CompatibilizaBIM Studio P1 without modifying main, secrets or existing installations.
# Requires Windows x64, Python 3.12 x64, Node 22 and .NET SDK 8.
# The preview package cannot activate without an owner-provided Ed25519 PUBLIC key.
[CmdletBinding()]
param(
  [switch]$SkipInstaller,
  [string]$IssuerPublicKeyPath = ""
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$integrated = Join-Path $root 'integrations\cbim-2.1.0'
$runtime = Join-Path $root 'runtime_min'
$stage = Join-Path $root '.p1-build'
$core = Join-Path $integrated 'compatibilizabim-core'
$sdk = Join-Path $integrated 'cbim-sdk\python'
$bridge = Join-Path $integrated 'dwg-acadsharp-bridge\CompatibilizaBIM.ACadSharpBridge.csproj'
$bridgeOut = Join-Path $runtime 'acadsharp'
$pythonOut = Join-Path $runtime 'python'

function Assert-Exit([string]$stageName) {
  if ($LASTEXITCODE -ne 0) { throw "Falha em $stageName (exit $LASTEXITCODE)" }
}
if (-not (Test-Path $bridge)) { throw "Ponte ACadSharp ausente: $bridge" }
New-Item -ItemType Directory -Force -Path @($stage, $bridgeOut, $pythonOut) | Out-Null

Push-Location $root
try {
  python -m pip install -e $sdk
  Assert-Exit 'CBIM SDK'
  python -m pip install -e "$core[ifc]"
  Assert-Exit 'CBIM Core + IFC'
  python -m pip install -r (Join-Path $root 'modules\compatibilizabim-requirements.txt')
  Assert-Exit 'Dependências IFC do visualizador'
  python -m pip install 'pyinstaller==6.21.0'
  Assert-Exit 'PyInstaller'

  dotnet publish $bridge -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:DebugType=None --output $bridgeOut
  Assert-Exit 'ACadSharp self-contained'
  $bridgeExe = Join-Path $bridgeOut 'CompatibilizaBIM.ACadSharpBridge.exe'
  if (-not (Test-Path $bridgeExe)) { throw "ACadSharp .exe não foi produzido." }

  $script = Join-Path $root 'scripts\p1_runtime_entry.py'
  $dist = Join-Path $stage 'pyinstaller-dist'
  $pyArgs = @(
    '--noconfirm', '--clean', '--onedir', '--console', '--name', 'cbim-runtime',
    '--distpath', $dist, '--workpath', (Join-Path $stage 'pyinstaller-work'),
    '--specpath', $stage, '--paths', (Join-Path $root 'modules'),
    '--paths', (Join-Path $core 'src'), '--paths', (Join-Path $sdk 'src'),
    '--collect-all', 'ifcopenshell', '--collect-all', 'shapely',
    '--collect-all', 'ezdxf', '--collect-all', 'cryptography',
    '--collect-all', 'pydantic', $script
  )
  python -m PyInstaller @pyArgs
  Assert-Exit 'Runtime Python autocontido'
  Copy-Item -Path (Join-Path $dist 'cbim-runtime\*') -Destination $pythonOut -Recurse -Force
  $runtimeExe = Join-Path $pythonOut 'cbim-runtime.exe'
  if (-not (Test-Path $runtimeExe)) { throw 'cbim-runtime.exe não foi produzido' }
  & $runtimeExe health
  Assert-Exit 'Smoke do runtime autocontido'

  if ($IssuerPublicKeyPath) {
    if (-not (Test-Path -LiteralPath $IssuerPublicKeyPath)) { throw 'Chave pública do emissor não encontrada' }
    $firstLine = (Get-Content -LiteralPath $IssuerPublicKeyPath -TotalCount 1)
    if ($firstLine -ne '-----BEGIN PUBLIC KEY-----') { throw 'Esperada chave pública PEM Ed25519 válida' }
    $licenseDir = Join-Path $root 'license'
    New-Item -ItemType Directory -Force -Path $licenseDir | Out-Null
    Copy-Item -LiteralPath $IssuerPublicKeyPath -Destination (Join-Path $licenseDir 'public.pem') -Force
  }

  if (-not $SkipInstaller) {
    Push-Location (Join-Path $root 'app')
    try {
      npm ci
      Assert-Exit 'npm ci'
      npm run dist:p1:windows
      Assert-Exit 'electron-builder NSIS P1'
    } finally { Pop-Location }
  }
  Write-Host 'P1 runtime validado. Não foi publicado nem foi alterada instalação existente.'
} finally { Pop-Location }
