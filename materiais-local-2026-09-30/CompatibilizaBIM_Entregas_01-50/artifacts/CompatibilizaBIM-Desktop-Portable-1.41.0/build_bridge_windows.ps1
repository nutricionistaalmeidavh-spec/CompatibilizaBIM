$ErrorActionPreference = "Stop"
$dotnet = "C:\Program Files\dotnet\dotnet.exe"
if (-not (Test-Path $dotnet)) { $dotnet = (Get-Command dotnet -ErrorAction Stop).Source }
$project = Join-Path $PSScriptRoot "bridge-source\CompatibilizaBIM.ACadSharpBridge.csproj"
& $dotnet restore $project
& $dotnet build $project -c Release
$exe = Join-Path $PSScriptRoot "bridge-source\bin\Release\net8.0\CompatibilizaBIM.ACadSharpBridge.exe"
Write-Host "ACadSharp bridge compilado: $exe"
