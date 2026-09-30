# Manifesto de entregas 01–10

| # | Entrega | Estado | Evidência principal |
|---|---|---|---|
| 01 | CBIM Foundation | Concluída | criação/serialização/validação |
| 02 | CBIM Schema | Concluída | JSON Schema + exemplo válido |
| 03 | Python SDK | Concluída | suíte CBIM 6/6 |
| 04 | .NET SDK | Implementada; build não executado | contrato estático testado; ambiente sem dotnet/MSBuild |
| 05 | CAD Geometry | Concluída | DXF real, normalização, 9 testes herdados |
| 06 | Topology | Concluída | noding, T/cross, faces e gap repair |
| 07 | Architecture | Concluída | walls/columns/doors/spaces + host |
| 08 | Levels & 3D | Concluída | storeys, Z e heights |
| 09 | Structural | Concluída | beam/slab/foundation-role/opening |
| 10 | Reviewer | Concluída | sessão de revisão + undo/redo + HTML offline/export |

## Limites desta entrega

- Não inclui IFC Bridge, DWG nativo, perfis CAD ou Revit plugin; são entregas posteriores.
- O reconhecimento atual é determinístico e orientado por convenções de layer/bloco. Não é ainda o motor de inteligência probabilística.
- `foundation` é representada nesta versão como `Slab` com `properties.structural_role="foundation"`, preservando o schema CBIM 0.2 sem quebra de contrato.
