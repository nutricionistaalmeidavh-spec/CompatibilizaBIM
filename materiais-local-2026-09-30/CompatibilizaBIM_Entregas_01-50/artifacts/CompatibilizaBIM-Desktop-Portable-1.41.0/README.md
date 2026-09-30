# CompatibilizaBIM Desktop Portable 1.41.0

Este pacote inicia a interface local do CompatibilizaBIM sobre um workspace persistente.

## Windows
1. Execute `install_windows.ps1` uma vez.
2. Para DWG nativo, execute `build_bridge_windows.ps1` uma vez.
3. Execute `launch_windows.bat CAMINHO_DO_WORKSPACE`.
4. Para validar um DWG hidráulico real: `./validate_hydraulic_windows.ps1 -Dwg C:\caminho\arquivo.dwg -Output C:\tmp\resultado`.

## Linux/macOS
1. Execute `./install_linux.sh` uma vez.
2. Execute `./launch_linux.sh CAMINHO_DO_WORKSPACE`.

Observação: este é o pacote desktop portável validado nesta entrega; MSI/EXE assinado é uma etapa de distribuição específica de Windows.


## IfcOpenShell (opcional na 1.41.0)

O exporter legado continua padrão. Para testar a nova montagem IFC via IfcOpenShell no Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install_windows.ps1 -InstallIfcOpenShell
```

Depois use `cbim-validate-dwg ... --ifc-backend ifcopenshell`. Use `--ifc-backend legacy` para comparação A/B.


## CBIM Catalog Brasil + MEP evidence (1.41.0)

A v1.41 adiciona reconhecimento MEP por evidências e catálogo neutro de famílias brasileiras. O catálogo não escolhe marca automaticamente. Integrações open source registradas: ACadSharp, IfcOpenShell, bSDD, CADTransformer, VecFormer e buildingSMART Sample-Test-Files; LibreDWG permanece referência não vinculada por exigência de revisão de licença GPL.
