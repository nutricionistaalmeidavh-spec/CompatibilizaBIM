# CompatibilizaBIM Studio — revisão, Gantt e tabela técnica canônicos

## Escopo
- react-resizable-panels: divide o visualizador espacial e o inspetor na superfície React de revisão, com proporções guardadas como preferência **visual** local. Em telas estreitas volta para a apresentação vertical.
- Frappe Gantt: projeta exclusivamente a lista de atividades devolvida por P2 \`status\` (ScheduleService / schedule.json), sem alterar datas, vínculos, progresso ou registro de simulação.
- Glide Data Grid: renderiza o conjunto de registros entregue por \`quantity_records\` e as linhas do \`budget_report\` sem nova store. Navegação/seleção de QTO preenche os campos **existentes** de vínculo e medição. Grupos sem custo nunca ganham preço inferido.

## Fronteiras de escrita
- Correções técnicas e mudanças de quantidades exigem nova fonte IFC/revisão validada. A grade é somente leitura.
- Cronograma e progresso continuam sendo escritos apenas pelos comandos P2 \`import_schedule\`, \`activity\`, \`link\`, \`progress\` e persistidos pelo ScheduleStore.
- Seleção de linhas altera apenas \`guid\` e \`quantity\` no formulário React, sem materializar cópias ou alterar medições.
- A ferramenta de redimensionamento altera apenas apresentação React. Os IDs de elementos, undo/redo, autosave, revisões e WorkspaceStore permanecem intactos.
- A importação e a exportação continuam idênticas; \`quantity_records\` é uma prévia limitada pelo serviço Python a 800 registros. Para dados completos, usar Exportar QTO CSV/JSON.

## Dados e restrições de qualidade
- Gantt recebe IDs, nome, datas, predecessores e avanço do Python; atividades sem datas válidas continuam na lista de origem e geram aviso na projeção.
- Grade preserva GUID, grandeza, unidade, origem e quantidade do IFC. Entradas \`geometry_fallback\` não podem preencher o formulário de medição.
- Quantitativos não são valores medidos, aprovados, pagos ou recebidos.
- Dependências OSS são empacotadas pelo Vite; não há chamadas CDN, servidor remoto nem assinatura.
- Glide Data Grid 6.0.4-alpha24 é versão pré-release fixada por compatibilidade com React 19. Não substituir por 6.0.3 (peer React <=18) nem instalar com \`--legacy-peer-deps\`.
- Seguir licenças MIT e manter avisos dos terceiros no empacotamento.

## Verificação
1. \`npm test\`: adaptadores de dados e contratos estáticos dos três componentes.
2. \`npm install --package-lock-only --prefix app && npm ci --prefix app && npm run build --prefix app\`.
3. Navegador Playwright/Electron: ampliar e reduzir inspetor, selecionar elemento e editar sem perder estado, retornar à obra.
4. Em estudo real com IFC: QTO => grade => selecionar GUID => aba Medições => verificar que a grandeza é a mesma. Confirmar que não é possível editar quantidade na grade.
5. Importar CSV 4D com predecessores, conferir gráfico e lista, registrar avanço por comando existente e recarregar. Nenhuma ação no gráfico deve modificar \`schedule.json\`.
6. Rodar gates de regressão CBIM Python/Node e validar o instalador Windows antes do merge.

Sem homologação visual de usuário/Windows real, a branch é implementação pendente de QA, não release aprovada.
