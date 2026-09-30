# Open-source integrations — Core 1.41.0

| Recurso | Licença | Papel no CompatibilizaBIM | Estado |
|---|---|---|---|
| ACadSharp | MIT | leitura DWG nativa | ativo |
| IfcOpenShell | LGPL-3.0-or-later | authoring/validação/engine IFC | opcional |
| buildingSMART bSDD | MIT (repo/API docs/examples) | dicionário semântico/adapter | adapter |
| CADTransformer | MIT | symbol spotting CAD | adapter de predictions |
| VecFormer | Apache-2.0 | symbol spotting vetorial CAD | adapter de predictions |
| buildingSMART Sample-Test-Files | CC BY 4.0 | conformance/regressão IFC | referência |
| GNU LibreDWG | GPL-3.0-or-later | fallback/referência DWG | não linkado; revisão legal necessária |

## Machine-learning seam
Modelos externos não controlam diretamente o CBIM. Eles podem anotar entidades canônicas com `ml_target`, `ml_system`, `ml_confidence` e `ml_source`; o `MepEvidenceEngine` usa isso como uma evidência limitada e auditável junto com CAD/profile/texto/conectividade.

## Datasets não incluídos
FloorPlanCAD, CubiCasa5K, ArchCAD-400K e outras bases com cláusulas non-commercial/research-only não são empacotadas nem usadas como dados comerciais nesta entrega.
