# CompatibilizaBIM — Roadmap oficial

A integração com o FluxoDRE é a **última etapa**. O CompatibilizaBIM deve ser um produto BIM independente e vendável antes de qualquer acoplamento financeiro.

## Fase 1 — Núcleo de coordenação BIM

| Etapa | Entrega | Estado |
|---|---|---|
| 01 | Visualizador / federação IFC | Concluída |
| 02 | Compatibilização / motor de regras | Concluída |
| 03 | Gestão de clashes / issues | Concluída |
| 04 | Comparação de revisões | Concluída |

### Fluxo fechado na v1.0

`IFC → preflight/federação → viewer → regras → issues → revisão → comparação → BCF/PDF/CSV`

A execução de regras no desktop registra automaticamente a revisão e importa as interferências no issue store. A tela permite alterar status, responsável, prazo, comentar e comparar duas revisões.

### Validação nativa ainda necessária fora deste runtime

A arquitetura está implementada e testada com backends controlados/fixtures. A certificação de produção continua exigindo projetos IFC reais com IfcOpenShell nativo, incluindo medição de tempo/memória e revisão visual dos resultados.

## Fase 2 — Monetização pesada

| Etapa | Entrega | Estado |
|---|---|---|
| 05 | Quantitativos BIM | Concluída |
| 06 | Orçamento 5D | Concluída em v1.3 |

### 05. Quantitativos BIM

- QTOs IFC (`IfcQuantityLength`, `Area`, `Volume`, `Count`, `Weight`);
- conversão de comprimento/área/volume para unidades SI;
- pavimento, classe IFC, tipo, material e disciplina;
- agrupamento sem perder a origem do dado;
- fallback geométrico de área/volume quando o IFC não possui a medida;
- fallback marcado explicitamente como `geometry_fallback`;
- JSON + CSV;
- execução por CLI e pelo desktop.

### 06. Orçamento 5D

- catálogo local de composições e insumos;
- coeficiente × preço unitário por componente;
- perdas por composição;
- BDI global;
- mapeamento IFC/QTO → composição;
- orçamento preservando pavimento/disciplina/tipo;
- curva ABC;
- grupos não mapeados/ambíguos são reportados, não estimados silenciosamente;
- fallback geométrico não é precificado por padrão;
- JSON + CSV + PDF;
- execução por CLI e pelo desktop.

O catálogo `samples/pricebook-demo.json` é apenas demonstrativo e **não representa preços SINAPI vigentes**.

### Fechamento da Fase 2 — v1.3

- atualização oficial SINAPI fail-closed (sem fallback para terceiros);
- referência 07/2026 registrada como a mais recente verificada em 15/08/2026;
- download/ZIP/XLSX validados antes da importação;
- procedência (URL CAIXA, SHA-256, competência, UF e datas) persistida e propagada ao orçamento;
- painel de readiness com cobertura de grupos/elementos e bloqueio de orçamento de referência incompleto;
- migração compatível dos bancos SINAPI criados na v1.2.

**Próxima etapa de produto: 07 Planejamento 4D ✅. A integração com FluxoDRE permanece bloqueada até a etapa 09.**

## Fase 3 — Grande diferenciação

| Etapa | Entrega | Estado |
|---|---|---|
| 07 | Planejamento 4D | Próxima |
| 08 | Medição BIM | Depois do 4D |
| 09 | Integração FluxoDRE | Última etapa |

### 07. Planejamento 4D

Vincular elementos/grupos IFC a atividades, datas, predecessoras e status para simular previsto × executado no tempo.

### 08. Medição BIM

Transformar avanço físico dos elementos/serviços em quantidades medidas, aprovadas e acumuladas por período.

### 09. Integração FluxoDRE

Somente após 4D e medição estarem estáveis. O contrato compartilhado deverá usar `obra_id`, sem incorporar o motor BIM ao núcleo financeiro.


## FASE 3 — DIFERENCIAÇÃO (concluída antes do FluxoDRE)
- 07 Planejamento 4D: concluído
- 08 Medição BIM + medição financeira: concluído
- 09 Integração FluxoDRE: **não implementada; permanece como última etapa**
