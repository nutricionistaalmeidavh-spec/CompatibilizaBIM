# CompatibilizaBIM v1.3.0 — Fechamento da Fase 2

## Escopo concluído

A Fase 2 cobre o ciclo `IFC → Quantitativos BIM → composição de custo → Orçamento 5D → auditoria/atualização SINAPI`.

### Quantitativos BIM
- QTO IFC por comprimento, área, volume, contagem e peso;
- pavimento, disciplina, classe, tipo e material;
- fallback geométrico explicitamente identificado;
- JSON/CSV e execução desktop.

### Orçamento 5D
- composições, coeficientes, perdas, BDI e curva ABC;
- mapeamento explícito BIM/QTO → composição;
- bloqueio de quantidade ambígua e de fallback geométrico sem autorização;
- JSON/CSV/PDF;
- comparação de competências/reorçamento.

### SINAPI oficial
- referência mais recente verificada nesta entrega: **2026-07**, divulgação **11/08/2026**;
- atualizador oficial por CLI e desktop;
- download permitido apenas de host CAIXA confiável;
- validação de ZIP, presença de XLSX, path traversal, criptografia e tamanho antes de publicar o arquivo;
- banco SQLite migrável/versionado;
- SHA-256, URL, provedor, data de publicação e data de download preservados;
- procedência propagada até o PriceBook e relatório de orçamento 5D;
- sem fallback silencioso para espelhos de terceiros.

## Critério de readiness

`Validar Fase 2` só marca um orçamento como pronto para referência quando:
- há quantitativos;
- todos os grupos foram precificados;
- não há ambiguidades/unidades incompatíveis pendentes;
- a base ativa possui procedência CAIXA, SHA-256, competência, UF e URL oficial.

O painel também informa cobertura por grupos e por elementos e destaca quantidades por fallback geométrico para revisão técnica.

## Limitação desta execução

O ambiente usado para gerar a entrega conseguiu verificar a competência mais recente nas fontes oficiais, mas não conseguiu recuperar o binário ZIP/XLSX estático da CAIXA. Portanto, **o arquivo oficial de julho/2026 não está embutido no ZIP da aplicação**. O atualizador foi testado end-to-end contra um servidor HTTP controlado, mas a execução contra o host CAIXA deve ser feita em uma máquina com acesso de rede normal.

Nenhuma base de terceiros foi utilizada como substituta.
