#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
dotnet restore "$ROOT/CompatibilizaBIM.ACadSharpBridge.csproj"
dotnet publish "$ROOT/CompatibilizaBIM.ACadSharpBridge.csproj" -c Release -r "${1:-linux-x64}" --self-contained false -o "$ROOT/publish"
echo "Bridge published to $ROOT/publish"
