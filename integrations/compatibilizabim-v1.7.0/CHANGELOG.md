# Changelog

## 1.7.0 — Fechamento Fase 2 / SINAPI oficial e readiness

- referência oficial SINAPI 07/2026 registrada com publicação em 11/08/2026;
- downloader oficial CAIXA com validação fail-closed de host, HTTPS, ZIP/XLSX e limites;
- comandos `compatibilizabim-sinapi latest` e `update`;
- provenance no SQLite: URL, provedor, publicação e data de download;
- migração do schema SINAPI v1 → v2 sem perda de releases;
- procedência propagada para PriceBook e relatório 5D;
- diagnóstico de readiness da Fase 2 com cobertura e pendências;
- atualização oficial e readiness integrados ao desktop/API;
- nenhum fallback para bases de terceiros.

## 1.1.0 — Fase 2: Quantitativos BIM + Orçamento 5D

- motor de quantitativos QTO IFC com agrupamento por disciplina/pavimento/classe/tipo/material;
- fallback geométrico explícito para área/volume ausentes;
- exportação JSON/CSV de quantitativos;
- catálogo de composições e insumos com coeficientes e preços unitários;
- perdas por composição e BDI global;
- mapeamento IFC/QTO para composições;
- proteção contra dupla contagem NetArea/GrossArea quando o mapeamento é ambíguo;
- fallback geométrico não precificado por padrão;
- orçamento por pavimento/disciplina/tipo e curva ABC;
- exportação JSON/CSV/PDF do orçamento 5D;
- CLIs `compatibilizabim-quantities` e `compatibilizabim-budget`;
- Quantitativos e Orçamento integrados ao desktop local;
- catálogo e quantitativos demonstrativos incluídos.

## 1.0.0 — Fase 1: Núcleo de coordenação

- compatibilização no desktop passa a importar issues automaticamente;
- cada execução de regras registra uma revisão imutável;
- edição de status, responsável, prazo e comentários na interface;
- comparação de revisões novo/persistente/resolvido dentro do desktop.
