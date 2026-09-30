# CompatibilizaBIM Desktop Portable 1.47.0

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

### Datum de projeto opcional
Para cotas absolutas grandes, use `-ProjectDatumElevationM 595.0` (exemplo) no script de validação. Sem datum, o Core não inventa um Z local.


## v1.47.0
- reconhecimento arquitetônico composto: escada, piso/laje, terminal sanitário e bancada antes de paredes
- continuidade de paredes colineares compatíveis
- reconstrução MEP com elbow/tee/cross/reducer explícitos
- tubos IFC circulares no backend legacy
- Psets/Qtos e sistemas de distribuição para melhor interoperabilidade Revit
- `install_ifcopenshell_windows.ps1` instala opcionalmente o backend IfcOpenShell
- `validate_hydraulic_windows.ps1 -IfcBackend legacy|ifcopenshell|auto` permite comparação A/B
