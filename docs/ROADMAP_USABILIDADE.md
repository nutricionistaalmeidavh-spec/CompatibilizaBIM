# Engenharia 360 — etapas de melhoria

## Etapa 1 — Fundação da navegação (entregue)

- Menu horizontal fino abaixo do cabeçalho.
- Acesso direto a Obras, Compatibilidade BIM, Cálculos, Operação e DRE.
- Estados offline e ações de backup sempre visíveis.
- BIM pode iniciar um estudo sem obra cadastrada.

## Etapa 2 — BIM compreensível (entregue nesta rodada)

- Resumo de cada modelo com disciplina, revisão, quantidade de elementos e classes IFC.
- Conflitos com gravidade textual, explicação do que ocorreu, localização aproximada e recomendação.
- Viewer federado com enquadramento automático, alta densidade de pixels, seleção por conflito, rotação, zoom e exportação PNG.
- Estudos independentes persistidos no SQLite; vínculo com obra permanece opcional.

## Etapa 3 — Operação diária (entregue)

### Integrações liberadas

- Obras → cadastro e Obra 360.
- Planejamento → etapas e cronograma visual.
- Diário de obra → RDO, aprovação, edição e PDF.
- Compras e materiais → materiais, quantidades e custos realizados.
- Tarefas → pendências, responsáveis e prioridades.
- Orçamento → calculadora de orçamento e Curva S.
- Painel → indicadores consolidados da obra selecionada.

Esses cartões agora abrem os fluxos existentes. Não foram copiados componentes do Fluxo DRE; foi reutilizado somente o catálogo de módulos e cada fluxo continua pertencendo ao seu software.

- Frentes, medições e contratos agora possuem persistência local e formulários operacionais.
- Filtros persistentes por obra, responsável, etapa e status.
- RDO em seções recolhíveis e salvamento como rascunho.

## Etapa 4 — Financeiro local (entregue em versão operacional)

- Painel, DRE operacional, contas e folha com dados offline da obra.
- Próximo refinamento: conciliação, trilha de auditoria detalhada e regras contábeis.
- Integração por adaptadores com os módulos do Fluxo DRE, sem juntar os softwares.

## Etapa 5 — Confiança e acessibilidade

- Foco de teclado e leitura por tecnologias assistivas.
- Mensagens de erro com causa, consequência e ação recomendada.
- Testes com IFC grande, IFC inválido, cancelamento e restauração de backup.
- Validação independente das calculadoras e identificação explícita da versão normativa.

## Etapa 6 — Relatórios e distribuição

- Memórias de cálculo, RDO e compatibilização em PDF com fonte Unicode/WinAnsi, paginação e sumário.
- Exportações JSON/CSV/PDF consistentes.
- Empacotamento offline com Python/IfcOpenShell e teste em máquina limpa.
