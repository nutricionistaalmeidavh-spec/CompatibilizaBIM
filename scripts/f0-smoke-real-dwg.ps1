# Runs against the bundled runtime on GitHub-hosted Windows. No installer execution.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$SamplesDir,
  [string]$OutputDir = ".p1-build/f0-smoke"
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtime=Join-Path $root 'runtime_min/python/cbim-runtime.exe'
$bridge=Join-Path $root 'runtime_min/acadsharp/CompatibilizaBIM.ACadSharpBridge.exe'
if (-not (Test-Path -LiteralPath $runtime)) { throw 'Runtime Windows não foi gerado.' }
if (-not (Test-Path -LiteralPath $bridge)) { throw 'Ponte ACadSharp não foi gerada.' }
$cases=@(
  @{name='BARRILETE';file='BARRILETE.dwg';discipline='hydraulic'},
  @{name='QUA-HID';file='QUA-HID-LO-0100-TERR-R02.dwg';discipline='hydraulic'}
)
$dest=Join-Path $root $OutputDir
New-Item -Force -ItemType Directory -Path $dest | Out-Null
$summary=@()
foreach($case in $cases) {
  $file=Join-Path $SamplesDir $case.file
  if (-not (Test-Path -LiteralPath $file)) {throw "DWG real não encontrado: $file"}
  $out=Join-Path $dest $case.name
  New-Item -Force -ItemType Directory -Path $out | Out-Null
  Write-Host "Executando ACadSharp/CBIM/IFC: $($case.name)"
  & $runtime validate-dwg "--$($case.discipline)" $file --output $out --bridge-exe $bridge --ifc-backend legacy
  $code=$LASTEXITCODE
  if ($code -gt 1) { throw "Falha de infraestrutura/runtime para $($case.name) (exit $code)" }
  $batchFile=Join-Path $out 'validation-batch.json'
  if (-not (Test-Path -LiteralPath $batchFile)) {throw "Relatório CBIM real não gerado para $($case.name)"}
  $batch=Get-Content -LiteralPath $batchFile -Raw | ConvertFrom-Json
  $report=@($batch.reports | Where-Object {$_.discipline -eq $case.discipline}) | Select-Object -First 1
  if (-not $report) {throw "Relatório da disciplina ausente: $($case.name)"}
  if ($report.provider -ne 'acadsharp') {throw "Provider inválido no caso $($case.name)"}
  if (-not $report.ifc_exported -or -not $report.ifc_sanity_passed) {
    throw "IFC não exportado/validado para $($case.name); confira logs e relatório"
  }
  $ifcs=@(Get-ChildItem -LiteralPath $out -Filter '*.ifc' -File)
  if (-not $ifcs.Count) {throw "Arquivo IFC não encontrado: $($case.name)"}
  $summary+=@{sample=$case.name;provider=$report.provider;coverage=$report.import_coverage;
    confidence=$report.mean_confidence;reviewPending=$report.review_pending_count;
    ifcExported=$report.ifc_exported;ifcSanity=$report.ifc_sanity_passed;passed=$report.passed;
    cliExit=$code;ifcCount=$ifcs.Count}
}
$reportFile=Join-Path $dest 'f0-windows-smoke-summary.json'
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportFile -Encoding UTF8
Write-Host "Smoke de DWGs reais concluído: $reportFile"
