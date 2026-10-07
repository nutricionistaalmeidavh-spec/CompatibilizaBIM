<#
.Verifica se os objetos LFS do backup realmente podem ser baixados do GitHub.
- Por padrão baixa somente os DWGs reais auditados (rápido).
- Use -IncludeBuildingSmart para baixar o ZIP de 470 MB e validar 810 entradas.
- Use -Full para baixar todos os objetos LFS e executar git lfs fsck.
Não modifica a main nem a branch de backup. Cria clone novo em $Destination.
#>
param(
  [string]$Destination = (Join-Path $env:TEMP 'cbim-lfs-verify-2026-09-30-v2'),
  [switch]$IncludeBuildingSmart,
  [switch]$Full
)
$ErrorActionPreference = 'Stop'
$repo = 'https://github.com/nutricionistaalmeidavh-spec/CompatibilizaBIM.git'
$branch = 'backup/all-cbim-materials-2026-09-30-v2'
$expectedCommit = '6feeb60e8b376def69d9e8ddb6b3788c56418397'
$relativeRoot = 'materiais-local-2026-09-30'
$dwgs = @(
  @{ Path = "$relativeRoot/DWG/BARRILETE.dwg"; SHA256 = 'b2f02c77c3028f3be107b2f06f78508321732015143a87443f884362002f9be5' },
  @{ Path = "$relativeRoot/DWG/QUA-HID-LO-0100-TERR-R02.dwg"; SHA256 = 'f48290b8b8d9fb626ece26d325f1f2570e134c61c17ebc12f812f6f49190ea17' }
)
$community = @{
  Path = "$relativeRoot/BiblioRVT/06_Projetos_Completos_RVT_IFC/buildingSMART_Community.zip"
  SHA256 = 'e07bd889e7837cb79e41774d9c156ec281def11154c3d8dc9db3ac1f33e34187'
}
& git lfs version | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Git LFS não está instalado/configurado.' }
if (Test-Path -LiteralPath $Destination) {
  throw "Destino já existe. Escolha um diretório novo com -Destination: $Destination"
}
$prior = $env:GIT_LFS_SKIP_SMUDGE
try {
  $env:GIT_LFS_SKIP_SMUDGE = '1'
  & git clone --single-branch --branch $branch $repo $Destination
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao clonar a branch de backup.' }
} finally {
  if ($null -eq $prior) { Remove-Item Env:\GIT_LFS_SKIP_SMUDGE -ErrorAction SilentlyContinue }
  else { $env:GIT_LFS_SKIP_SMUDGE = $prior }
}
Push-Location -LiteralPath $Destination
try {
  $sha = (& git rev-parse HEAD).Trim()
  if ($sha -ne $expectedCommit) { throw "Commit diferente do esperado: $sha" }
  if ($Full) {
    & git lfs pull
    if ($LASTEXITCODE -ne 0) { throw 'Falha no download integral do LFS.' }
    & git lfs fsck
    if ($LASTEXITCODE -ne 0) { throw 'Git LFS fsck detectou objetos ausentes/corrompidos.' }
  } else {
    $paths = @($dwgs | ForEach-Object { $_.Path })
    if ($IncludeBuildingSmart) { $paths += $community.Path }
    $include = $paths -join ','
    & git lfs pull --include=$include --exclude=''
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao baixar amostras LFS.' }
  }
  $targets = @($dwgs)
  if ($Full -or $IncludeBuildingSmart) { $targets += $community }
  $checks = @()
  foreach ($item in $targets) {
    $file = Join-Path $Destination ($item.Path.Replace('/','\'))
    if (!(Test-Path -LiteralPath $file)) { throw "Objeto LFS ausente: $($item.Path)" }
    $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    $match = ($actual -eq $item.SHA256)
    $checks += [PSCustomObject]@{ path = $item.Path; sha256_ok = $match; expected = $item.SHA256; actual = $actual }
    if (!$match) { throw "SHA-256 divergente: $($item.Path)" }
  }
  $zipEntries = $null
  if ($Full -or $IncludeBuildingSmart) {
    Add-Type -AssemblyName System.IO.Compression
    $zipPath = Join-Path $Destination ($community.Path.Replace('/','\'))
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try { $zipEntries = $zip.Entries.Count }
    finally { $zip.Dispose() }
    if ($zipEntries -ne 810) { throw "O buildingSMART_Community.zip tem $zipEntries entradas, esperadas 810." }
  }
  $report = [PSCustomObject]@{
    branch = $branch; commit = $sha; checked_at = (Get-Date).ToString('o')
    mode = $(if ($Full) { 'full' } elseif ($IncludeBuildingSmart) { 'samples+zip' } else { 'samples' })
    checks = $checks; zip_entries = $zipEntries; result = 'PASS'
  }
  $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Destination 'lfs-integrity-report.json') -Encoding UTF8
  Write-Host 'PASS: backup Git e objetos LFS selecionados verificados.'
  Write-Host "Relatório: $(Join-Path $Destination 'lfs-integrity-report.json')"
} finally {
  Pop-Location
}
