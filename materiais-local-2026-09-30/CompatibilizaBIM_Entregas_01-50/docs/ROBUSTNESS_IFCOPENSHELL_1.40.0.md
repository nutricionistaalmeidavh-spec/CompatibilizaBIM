# Core 1.40.0 — Robustez + fronteira IfcOpenShell

## Objetivo

Esta versão reage a evidências de DWGs reais, não apenas fixtures: Geometry e Topology já haviam sido endurecidos nas versões 1.38/1.39; o traceback real seguinte localizou o mesmo padrão de escala em Architecture (`wall_pair`). A 1.40 revisa Architecture, Structure e Connectivity e estabelece a fronteira opcional CBIM→IfcOpenShell.

## Escala

- Architecture: geometrias `LineString` são criadas uma vez; `STRtree` limita a comparação a linhas próximas; host de portas/janelas e labels de espaços também usam índice espacial.
- Structure: pares de linhas de vigas são candidatos espaciais, não combinações globais.
- Connectivity: fittings/equipment sobre pipes usam STRtree; clustering e nearest-node usam hash espacial 3D.
- O callback de progresso recebe `rss_mb` quando possível.

## IfcOpenShell

`IfcOpenShellBridge` é um backend opcional. Ele mantém o CBIM como contrato semântico e move a montagem IFC para uma biblioteca IFC especializada. O backend mapeia as classes CBIM atuais para IFC4, cria Project/Site/Building/Storey, atribui containment e systems, grava propriedades `CompatibilizaBIM` e cria geometria mesh.

O exporter legado continua default na 1.40 para não trocar silenciosamente uma saída já verificada por uma dependência que não pôde ser executada neste ambiente (sem internet/IfcOpenShell instalado). No Windows, instalar o extra e usar `--ifc-backend ifcopenshell` permite A/B real.

## Evidência executada neste ambiente

- 89 testes Core: PASS.
- 6 testes CBIM SDK: PASS.
- Architecture synthetic 20k lines: ~0.88 s neste ambiente.
- Structure synthetic 20k lines: ~0.61 s neste ambiente.
- Compileall: PASS.

## Limitação explícita

Os DWGs reais foram preservados e catalogados, mas este runtime não possui .NET/ACadSharp nem IfcOpenShell instalável por rede. Portanto, a prova final da 1.40 continua sendo executar a base real no Windows, especialmente o QUA-HID que expôs os gargalos anteriores, e comparar `legacy` vs `ifcopenshell` no IFC.
