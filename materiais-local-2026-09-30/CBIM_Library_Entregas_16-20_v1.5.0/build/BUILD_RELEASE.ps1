param(
  [string]$RevitDir = "C:\Program Files\Autodesk\Revit 2027",
  [switch]$InstallAfterBuild
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root "dist"
$Dotnet = "C:\Program Files\dotnet\dotnet.exe"
if (-not (Test-Path $Dotnet)) { $Dotnet = (Get-Command dotnet -ErrorAction SilentlyContinue)?.Source }
if (-not $Dotnet) {
  Write-Host "SDK .NET 10 não encontrado. Instalando via winget..."
  winget install --id Microsoft.DotNet.SDK.10 --exact --accept-package-agreements --accept-source-agreements
  $Dotnet = "C:\Program Files\dotnet\dotnet.exe"
}
if (-not (Test-Path $Dotnet)) { throw "dotnet não encontrado." }
if (-not (Test-Path (Join-Path $RevitDir "RevitAPI.dll"))) { throw "RevitAPI.dll não encontrada em $RevitDir" }
Remove-Item $Dist -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Dist | Out-Null

$PluginOut = Join-Path $Dist "plugin"
& $Dotnet build (Join-Path $Root "src\CBIM.Library.Revit2027\CBIM.Library.Revit2027.csproj") -c Release -p:RevitInstallDir="$RevitDir" -o $PluginOut
if ($LASTEXITCODE -ne 0) { throw "Build do plugin falhou." }
Get-ChildItem $PluginOut -Filter "RevitAPI*.dll" -ErrorAction SilentlyContinue | Remove-Item -Force
$Payload = Join-Path $Root "src\CBIM.Library.Installer\Resources\payload.zip"
New-Item -ItemType Directory -Force -Path (Split-Path $Payload) | Out-Null
Remove-Item $Payload -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $PluginOut "*") -DestinationPath $Payload -CompressionLevel Optimal

$PublisherOut = Join-Path $Dist "publisher"
& $Dotnet publish (Join-Path $Root "src\CBIM.Library.Publisher\CBIM.Library.Publisher.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $PublisherOut
if ($LASTEXITCODE -ne 0) { throw "Build do Publisher falhou." }
$InstallerOut = Join-Path $Dist "installer"
& $Dotnet publish (Join-Path $Root "src\CBIM.Library.Installer\CBIM.Library.Installer.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $InstallerOut
if ($LASTEXITCODE -ne 0) { throw "Build do instalador falhou." }

$Release = Join-Path $Dist "release";New-Item -ItemType Directory -Force -Path $Release | Out-Null
$Setup = Get-ChildItem $InstallerOut -Filter "CBIM.Library.Setup.exe" | Select-Object -First 1
$SetupDest = Join-Path $Release "CBIM-Library-Setup-Revit2027-v1.5.0.exe";Copy-Item $Setup.FullName $SetupDest
$Pub = Get-ChildItem $PublisherOut -Filter "CBIM.Library.Publisher.exe" | Select-Object -First 1
Copy-Item $Pub.FullName (Join-Path $Release "CBIM-Library-Publisher-v1.5.0.exe")
Copy-Item (Join-Path $Root "README.md") $Release;Copy-Item (Join-Path $Root "CHANGELOG.md") $Release
(Get-FileHash $SetupDest -Algorithm SHA256).Hash.ToLowerInvariant() | Set-Content (Join-Path $Release "SHA256.txt")
Write-Host "";Write-Host "Release criada em: $Release" -ForegroundColor Green;Get-ChildItem $Release | Format-Table Name,Length
if ($InstallAfterBuild) { & $SetupDest }
