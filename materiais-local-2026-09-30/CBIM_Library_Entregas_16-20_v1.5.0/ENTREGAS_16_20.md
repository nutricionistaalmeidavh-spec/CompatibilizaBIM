# Entregas 16–20 — CBIM Library

## Entrega 16 — Library Intelligence
- Metadados técnicos por arquivo: disciplina, categoria, sistema, material, DN, código e versão.
- Type Catalog `.txt` ao lado de RFA.
- Inspeção RFA pelo Revit: tipos, parâmetros, conectores e contagem de elementos.
- Score de qualidade 0–100.
- Busca técnica ranqueada e comparação de similares.
- Carregamento de tipo específico e preview cacheado após carregamento.

## Entrega 17 — Distribuição segura
- `manifest.json` schema v2.
- Atualização diferencial arquivo a arquivo.
- Reaproveitamento de arquivo local quando SHA-256 bate.
- Canais `stable` e `preview`.
- Assinatura RSA opcional; cliente recebe apenas chave pública.
- Publisher com `staging-report.json`.
- Rollback individual por pacote.

## Entrega 18 — Project Intelligence
- Smart Insert usando o comando nativo de posicionamento do Revit.
- Substituição de FamilyInstance por FamilySymbol de categoria compatível.
- Kits de novo projeto com RTE + famílias/tipos + RVT de padrões.
- Standards Manager para view templates, filtros, materiais, fill/line patterns, text e dimension types.

## Entrega 19 — Diagnóstico / quantitativos
- Índice incremental: hash só é recalculado quando tamanho/data do arquivo mudam.
- Terceira origem opcional: `Biblioteca da Empresa`, somente leitura.
- Relatório HTML de saúde do acervo.
- Overrides manuais de classificação técnica.
- Campos de unidade, SINAPI e descrição de custo.
- Exportação do catálogo quantitativo para o Bridge.

## Entrega 20 — Learning Ready
- `Bridge/Outbox`: vocabulário, quantitativos e observações de aprendizagem.
- `Bridge/Inbox`: feedback retornado pelo CBIM Core.
- Registro de exemplos positivos apenas após operação Revit bem-sucedida ou confirmação manual.
- Aliases e boosts de busca aprendidos a partir do feedback.
- Nenhum treinamento automático nesta fase: primeiro coletamos e validamos sinais reais.
