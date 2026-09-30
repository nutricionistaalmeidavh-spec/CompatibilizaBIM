# CompatibilizaBIM — Entregas cumulativas 01–50

Estado cumulativo do projeto CAD → CBIM → BIM, mantendo o **CBIM como contrato intermediário independente** do CompatibilizaBIM Core e do plugin Revit.

## Entregas incluídas

01. CBIM Foundation  
02. CBIM Schema  
03. CBIM Python SDK  
04. CBIM .NET SDK  
05. CAD Geometry Engine  
06. Topology Engine  
07. Architecture Recognition  
08. Levels & 3D Reconstruction  
09. Structural Recognition  
10. CAD/BIM Reviewer  
11. CAD Profiles  
12. IFC Bridge  
13. DWG Provider Boundary  
14. Hydraulic Recognition  
15. Fire Recognition  
16. Brazilian Catalog  
17. MEP Connectivity  
18. Recognition Intelligence  
19. Quantities  
20. CompatibilizaBIM Core Integration Boundary  
21. CBIM Revision Diff  
22. Performance & Incremental Planning  
23. Complex / Multi-Tower Buildings  
24. XREF & Multi-file CAD Composition  
25. Georeferencing & Large Coordinates  
26. Advanced Geometry  
27. Vertical / Repeated Building Intelligence  
28. Incremental Reprocessing  
29. XXL Benchmark Suite  
30. Production / Scalability Gate  
31. ACadSharp Native DWG Provider  
32. DWG Import Diagnostics  
33. DWG Compatibility Suite  
34. Native DWG XREF Validation  
35. DWG → CBIM → IFC Full Pipeline  
36. Real DWG Architecture Validation  
37. Real DWG Structural Validation  
38. Real DWG Hydraulic Validation  
39. Real DWG Fire Validation  
40. Multi-Discipline Real Project Federation  
41. Import Wizard  
42. Recognition Review UI  
43. Project Configuration Wizard  
44. CAD Profile Learning  
45. Conversion Report  
46. Project Persistence  
47. Autosave / Recovery / Crash Safety  
48. Desktop Packaging  
49. Customer Configuration / Offline Licensing  
50. First Commercial Pilot Gate

## Fluxo acumulado

`DXF / DWG-provider / XREF → georeferencing/local frame → CAD Profiles → Advanced Geometry → Geometry → Topology → Architecture/Structure → Levels/Vertical Intelligence → MEP → Connectivity → Catalog → Intelligence → CBIM → Diff / Quantities / Core Snapshot / IFC`

## Entregas 26–30

### 26 — Advanced Geometry

- análise de arcos, círculos, splines, geometrias inclinadas e não ortogonais;
- detecção de polylines fechadas auto-intersectantes;
- tesselação adaptativa por tolerância de corda;
- proveniência da curva CAD original preservada nos segmentos gerados;
- curvas podem alimentar consumidores CBIM baseados em segmentos sem fingir que a aproximação é exata;
- demo de parede curva gera 30 segmentos de parede CBIM mantendo referências aos dois arcos originais.

### 27 — Vertical / Repeated Building Intelligence

- fingerprint geométrico por pavimento e edifício;
- detecção de pavimentos realmente repetidos usando geometria, não apenas contagem de elementos;
- detecção de alinhamentos verticais, colunas empilhadas, risers e shafts;
- plano de propagação de pavimento-tipo;
- propagação preserva `host_id`, relações internas, materiais, sistemas e deslocamento Z.

### 28 — Incremental Reprocessing

- fingerprint de entidades, blocos e configurações;
- mudanças locais recebem recorte espacial com halo;
- alteração de block definition, INSERT ou remoção força rebuild global conservador;
- impacto CBIM é propagado por `source_refs` e relações;
- escolha real entre processor local e global;
- otimização para evitar hashing duplicado de documentos grandes.

### 29 — XXL Benchmark Suite

Artefato padrão desta entrega:

- 4 torres;
- 160 pavimentos;
- 51.200 entidades CAD sintéticas;
- 1.440 tiles espaciais;
- edição local de uma entidade;
- medição de particionamento, fingerprint, planejamento incremental, hierarquia e memória Python.

O benchmark é sintético e reproduzível. Ele **não substitui validação com DWGs de uma obra real**.

### 30 — Production / Scalability Gate

O gate possui dois níveis:

1. **Technical gate** — testes, cobertura, benchmark XXL, memória, locality incremental, precisão de coordenadas, IFC round-trip e empacotamento.
2. **Production gate** — além do technical gate, exige provider DWG nativo validado e pelo menos um edifício grande/alto padrão real processado end-to-end.

Nesta entrega o **technical gate passa**, mas `production_ready=false`, pois os dois critérios externos acima ainda não podem ser comprovados neste ambiente. Isto é deliberado: fixture sintético nunca pode se passar por validação de obra real.

## Evidências principais

Veja `artifacts/`:

- `advanced-geometry-01-30.summary.json`
- `advanced-geometry-01-30.cbim.json`
- `vertical-intelligence-01-30.json`
- `vertical-propagated-01-30.cbim.json`
- `incremental-reprocessing-01-30.json`
- `xxl-benchmark-01-30.json`
- `coordinate-roundtrip-01-30.json`
- `production-gate-roundtrip-01-30.ifc`
- `production-scalability-gate-01-30.json`

## Limites explícitos

- ACadSharp (MIT) é agora o provider DWG nativo principal. O source do bridge está incluído; a validação de produção exige compilar esse bridge e testá-lo em DWGs reais. ODA/RealDWG permanecem apenas como fallback opcional.
- Importação genérica de IFC de terceiros continua reservada a backend apropriado, como IfcOpenShell; o bridge incluído prova o round-trip CBIM que ele próprio exporta.
- Splines do modelo CAD canônico ainda não armazenam knots/weights; por isso sua tesselação é explicitamente marcada como aproximação do control polygon.
- O SDK .NET continua independente e não depende da Revit API; o build .NET não foi executado neste ambiente porque `dotnet`/MSBuild não estão instalados.
- O benchmark XXL mede infraestrutura de escala e incrementalidade; uma obra real complexa continua sendo requisito obrigatório do Production Gate.

Veja `docs/VERIFICATION_01_30.md` e `docs/DELIVERY_MANIFEST_01_30.md`.

## Native open-source DWG (31–35)

ACadSharp bridge source, import diagnostics, compatibility matrix, native XREF resolution and DWG→CBIM→IFC orchestration are included. The bridge remains an independent .NET process and no ACadSharp type leaks into the Python Core or CBIM contract.

## Real DWG validation and federation (36–40)

The project now includes discipline-aware evidence harnesses for architecture, structure, hydraulic and fire DWGs. Each validation report measures native-import coverage, unsupported entities, source-to-CBIM recognition, confidence, review backlog, MEP connectivity and IFC export sanity.

`cbim-validate-dwg` executes the four discipline files and produces per-discipline CBIM/IFC/JSON reports plus a federated snapshot with ID-collision checks and cross-discipline clash candidates.

A crucial evidence rule is enforced in code: fixtures and public compatibility samples **cannot** unlock production readiness. `production_evidence_eligible=true` requires actual `real_project` inputs processed by provider `acadsharp`, passing all discipline thresholds and federation checks.

The IFC bridge was also extended in this delivery to emit visible `IFCPIPESEGMENT` and `IFCPIPEFITTING` entities (plus equipment proxy geometry), rather than relying only on the embedded lossless CBIM round-trip payload for MEP.

### Current external blocker

This execution environment has no .NET SDK/NuGet and no outbound DNS, so the ACadSharp bridge could not be restored/compiled here. The Python contract, validation framework, federation, MEP IFC export and 60 Core tests are executable. Actual client/public DWG binary execution remains the remaining external proof step.

See `docs/DELIVERY_MANIFEST_01_40.md`, `examples/real-dwg-validation/` and `artifacts/validation-01-40-fixture-summary.json`.

## Product workflow (41–45)

The cumulative package now includes a self-contained local **CompatibilizaBIM Studio**. It covers source planning, project/storey configuration, visual CBIM review with undo/redo, conservative CAD-profile learning and conversion-readiness reporting.

Open `artifacts/compatibilizabim-studio-01-45.html` in a browser for the product-flow demo, or use:

```bash
cbim-product plan ARQ.dwg ESTR.dwg HID.dwg INC.dwg --name "Projeto" -o import-plan.json
cbim-product studio --project projeto.cbim.json --plan import-plan.json -o studio.html
cbim-product report --project projeto.cbim.json --plan import-plan.json -o report.html
```

The UI never replaces CBIM as the source of truth: reviewed data is exported back to `.cbim.json` and downstream IFC/quantity/federation modules continue to consume the same contract.

See `docs/DELIVERY_MANIFEST_01_45.md` and `docs/VERIFICATION_01_45.md`.


## Commercial/Desktop workflow (46–50)

O projeto agora possui workspace persistente, autosave e recuperação, servidor desktop local, pacote portável, configuração por cliente e licença offline Ed25519. O Studio aberto por `cbim-desktop` consegue salvar o CBIM revisado diretamente ao workspace usando a API local.

```bash
cbim-desktop create ./meu-projeto --project projeto.cbim.json --plan import-plan.json
cbim-desktop serve ./meu-projeto
cbim-desktop status ./meu-projeto
```

Licenciamento e gate comercial:

```bash
cbim-commercial keygen --private issuer.pem --public issuer-public.pem
cbim-commercial customer --id cliente-01 --name "Cliente" -o customer.json
cbim-commercial issue --private issuer.pem --customer customer.json --license-id LIC-001 -o license.json
cbim-commercial verify --public issuer-public.pem --customer customer.json --license license.json
cbim-commercial pilot-gate --evidence pilot-evidence.json
```

O `FirstCommercialPilotGate` desta entrega permanece propositalmente bloqueado: um fixture não pode substituir DWGs reais de um cliente. Veja `docs/DELIVERY_MANIFEST_01_50.md` e `docs/VERIFICATION_01_50.md`.

## Real-DWG hardening — Core 1.38.0

A versão 1.38.0 incorpora as primeiras evidências de DWGs reais. O recognizer agora distingue tubulação (`*-TB`) de conexão (`*-CX`) nas convenções observadas, separa hidráulica/incêndio, corrige a métrica de reconhecimento MEP e evita inferir fabricante sem evidência. A normalização de linhas colineares foi reescrita para escala de projeto real, e o CLI mostra tempos por estágio.

Veja `docs/REAL_DWG_HARDENING_1.38.0.md`. O pacote desktop `artifacts/CompatibilizaBIM-Desktop-Portable-1.38.0/` inclui scripts Windows para compilar o bridge ACadSharp e repetir a validação real sem editar o código.

## Topology scalability hardening — Core 1.39.0

A real 45,690-entity normalized DWG exposed an all-pairs intersection bottleneck in Topology. Core 1.39.0 replaces that path with Shapely STRtree spatial indexing, indexes gap repair and face attribution, and emits topology substage timings. See `docs/TOPOLOGY_HARDENING_1.39.0.md`.

The Windows portable package is now `artifacts/CompatibilizaBIM-Desktop-Portable-1.39.0/`. Rebuild the bundled ACadSharp bridge with `build_bridge_windows.ps1`, then rerun the large hydraulic DWG with `validate_hydraulic_windows.ps1`.


## Core 1.40.0 — recognizer scale + IfcOpenShell integration boundary

A versão 1.40.0 trata o padrão de gargalos exposto pelos DWGs reais: Architecture e Structure agora usam índices espaciais em vez de comparação global de pares, e MEP Connectivity usa STRtree + hash espacial para componentes e nós. O progresso passa a incluir RSS de memória quando disponível.

A fronteira IFC foi formalizada sem remover o fallback comprovado: `IFCBridge()` continua usando o exporter legado por compatibilidade, enquanto `IFCBridge(backend="ifcopenshell")` usa o novo `IfcOpenShellBridge` quando a dependência opcional está instalada. O adapter cria hierarquia Project/Site/Building/Storey, mapeia Wall/Column/Beam/Slab/Pipe/Fitting/Equipment, atribui sistemas de distribuição, propriedades `CompatibilizaBIM` e geometria mesh visível. `IFCBridge.validate_with_ifcopenshell()` executa validação de schema quando o backend está disponível.

No CLI real-DWG, use `--ifc-backend ifcopenshell` para testar a nova saída ou mantenha `legacy` (default) para comparação A/B. Veja `docs/ROBUSTNESS_IFCOPENSHELL_1.40.0.md`.


## Core 1.40.1 — hotfix de progresso da Architecture

Corrige a falha de telemetria observada no Windows quando `architecture_wall_candidates` concluía sem `elapsed`: a subetapa agora mede tempo real e o formatter de progresso aceita `elapsed=None` sem derrubar o pipeline. Nenhuma regra semântica foi removida.

## Core 1.41.0 — CBIM Catalog Brasil + recognizer MEP por evidências

A v1.41 reduz falsos positivos MEP observados na comparação visual DWG→IFC/Revit. Layers arquitetônicos/contextuais (como `ALVENARIA`, `ESCADA`, `PROJEÇÃO`, `EIXO`, `PISO`, `VAGAS`, `FOLHA`, `FORRO` e `LAYOUT`) são separados antes da classificação MEP. O recognizer passa a combinar layer/perfil, bloco, DN/material em texto próximo, conectividade e padrões geométricos negativos; sequências curtas/paralelas/repetitivas sem evidência MEP são tratadas como padrão de escada e não viram pipes automaticamente.

O **CBIM Catalog Brasil** foi ampliado como camada neutra de correspondência por famílias: Amanco Wavin, Tigre, Krona, Astra, Fortlev e adapters para Docol, Victaulic, Viking, Reliable, Schneider Electric e Siemens. Match de catálogo apenas aconselha/reranqueia um elemento que já é semanticamente plausível; fabricante continua proibido de ser inferido sem especificação explícita do projeto/usuário.

A arquitetura open source agora possui registry e seams explícitos para ACadSharp, IfcOpenShell, buildingSMART bSDD, CADTransformer, VecFormer, buildingSMART Sample-Test-Files e LibreDWG. CADTransformer/VecFormer podem fornecer hints via metadados `ml_*`, sempre como evidência auxiliar. Datasets com restrição non-commercial não são incluídos na distribuição.

Veja `docs/CBIM_CATALOG_BRASIL_1.41.0.md`, `docs/OPEN_SOURCE_INTEGRATIONS_1.41.0.md` e `docs/VERIFICATION_1.41.0.md`.


## Core 1.42.0 — MEP Semantic Gate

A v1.42 torna a criação automática de MEP mais conservadora: layer/geometria sozinhos não criam Pipe/Fitting. O Core exige evidência independente (DN/sistema em texto, perfil CAD explícito, componente MEP reconhecido, propagação colinear de rede ou hint externo de alta confiança). Linhas ambíguas ficam como candidatos de revisão e não contaminam o IFC.

Novos diagnósticos: `evidence_auto_create_count`, `evidence_candidate_count` e `evidence_rejected_count`, além de resumo de layers candidatos no metadata do projeto.

Veja `docs/MEP_SEMANTIC_GATE_1.42.0.md`, `docs/DELIVERY_1.42.0.md` e `docs/VERIFICATION_1.42.0.md`.

## Core 1.43.0 — Text Intelligence
A v1.43 adiciona leitura estruturada e associação espacial de textos CAD para DN/diâmetro, material, sistema, altura, nível/cota e indicações SOBE/DESCE/PRUMADA. As alturas são preservadas como hints CBIM e ainda não alteram Z automaticamente nesta etapa.

Veja `docs/TEXT_INTELLIGENCE_1.43.0.md`, `docs/DELIVERY_1.43.0.md` e `docs/VERIFICATION_1.43.0.md`.

## Core 1.44.0 — MEP Z Reconstruction
Converte evidências `h=`, níveis, `SOBE/DESCE` e prumadas em Z conservador, propaga alturas apenas por redes MEP coerentes e mantém casos ambíguos em revisão. Veja `docs/MEP_Z_RECONSTRUCTION_1.44.0.md` e `docs/VERIFICATION_1.44.0.md`.


## Core 1.47.0 — Revit Quality Reconstruction
A entrega consolida as etapas arquitetônica, MEP e IFC/Revit: padrões de escada são reconhecidos antes do fallback de paredes, contornos de piso/laje são promovidos a Slab, pias/terminais sanitários e bancadas recebem classes CBIM próprias, paredes colineares compatíveis são mescladas, e a rede MEP ganha fittings explícitos em mudanças de direção/derivações/reduções. O exporter IFC legacy usa seção circular por IfcSweptDiskSolid, inclui sistemas de distribuição, propriedades e quantidades; o backend IfcOpenShell opcional recebe as mesmas classes semânticas.

A validação em DWG real/Revit continua necessária: testes unitários/sintéticos não provam que toda escada, piso, pia, fitting ou cota Z do QUA-HID foi reconstruída corretamente. Veja `docs/DELIVERY_1.47.0.md`.


## Core 2.1.0 — Revit phases 14–16

A linha Revit mantém os produtos separados e reutiliza o mesmo CBIM Core:

- **Plugin CBIM Revit 2027**: DWG → CBIM → plano de autoria nativa sem IFC obrigatório, com reconstrução genérica de níveis, paredes, pisos e famílias resolvidas. O plugin genérico não cria Pipe/Fitting para evitar duplicação; o MEP pertence ao plugin hidráulico.
- **CBIM Library Contract**: contrato seguro com o Plugin Biblioteca por `%LOCALAPPDATA%\CBIM\Library\manifest.json`; somente `.rfa` locais dentro de roots declaradas podem ser resolvidos. Famílias proprietárias não são redistribuídas.
- **Plugin CBIM Hidráulica**: continua automaticamente do último plano do Core, preserva Z/DN/sistema, segmenta pipes e cria fittings nativos por conectores (`elbow`, `tee`, `cross`, `transition/reducer`). Near-miss não é snapado silenciosamente.
- **Bootstrap Windows**: instala o `cbim-revit` em ambiente local, compila/copia o bridge ACadSharp e configura `CBIM_REVIT_CLI` + `CBIM_ACADSHARP_BRIDGE`.

Veja `docs/DELIVERY_REVIT_PHASES_14_16_2.1.0.md` e `revit-plugins/README.md`.
