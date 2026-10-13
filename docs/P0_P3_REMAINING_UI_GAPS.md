# P0–P3 — complementação incremental da interface única React

## Escopo conferido contra a main
Esta rodada parte da integração já aprovada no PR #17; não reinstala Forms Kit, Glide Data Grid, Frappe Gantt, painéis redimensionáveis ou o motor de cálculo. Nenhuma nova base, segundo shell ou serviço em nuvem foi criado.

| Prioridade | Já existente | Lacuna complementar entregue |
|---|---|---|
| P0 | Campos por schema, feedback, RDO, confirmação/auditoria de conflitos | Busca local por nome, disciplina, revisão e arquivo nos modelos registrados |
| P1 | ReviewSplit, Gantt 4D, F7 diagnósticos, logs de execução | Explorador de fontes com revisão/proveniência e contagem explícita de conflitos pendentes |
| P2 | Exportações PDF/CSV/JSON, SHA-256 do motor QTO e dos artefatos Windows, smoke Playwright | Prévia tabular de CSV, verificação de datas, predecessoras, ciclos e duplicatas antes de confirmar importação 4D |
| P3 | IfcOpenShell nativo para extração QTO, grade 5D virtualizada | Consulta de entidades IFC diretamente da fonte original, com seleção de classe, GUID, texto e paginação, somente leitura |

### Preservação canônica
- Busca de arquivos e avisos são projeções dos registros existentes no SQLite; não geram nem alteram projetos.
- A prévia CSV não salva nada. Ao confirmar, o mesmo comando P2 Python (`import_schedule`) revalida, persiste e reverte em caso de erro.
- A consulta IFC aceita apenas nome seguro presente no `model_files` e mapa `revision_sha256` do QTO persistido. Recalcula SHA-256 **real** do arquivo guardado em `sources`, bloqueia divergência e acesso a caminhos externos.
- O backend Python abre o IFC com IfcOpenShell (sem geometria inventada); só retorna propriedades básicas de classe, GUID, nome e descrição. Limites: fonte ≤ 64 MiB, 100 registros por página no IPC, no máximo deslocamento 5000, consulta textual de até 120 caracteres.
- Estado de consulta e prévia é efêmero no React, sem nova store. A busca não afirma compatibilização geométrica, contabilidade ou homologação de projeto.
- Nenhuma extensão Univer ou XYFlow foi instalada: seriam opcionais e duplicariam recursos de planilha e grafo sem necessidade canônica demonstrada.

### QA e pendências de ambiente externo
- Node, Vite, Playwright e Python P2/IfcOpenShell testados pelo workflow `.github/workflows/cbim-p0-p3-gap-qa.yml`, disparado por mudança específica do próprio workflow ou manualmente.
- O piloto com DWG/IFC reais, validação normativa, instalação Windows limpa, assinatura e licença são gates humanos/de distribuição separados. O CI não os marca como aprovados.

- Novas importações IFC/CBIM pelo React recebem identidade criptográfica `sha256:` (arquivo completo, sem amostragem). Identificadores FNV históricos permanecem válidos nos snapshots antigos e são rotulados como legados; não se reescrevem dados persistidos.
- A lista de conflitos da análise mais recente também aceita pesquisa textual (GUID, origem, responsável e classe), preservando filtros e status; lista grande informa o limite de 250 itens.
