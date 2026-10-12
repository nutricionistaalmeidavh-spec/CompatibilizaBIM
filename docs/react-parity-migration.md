
# CompatibilizaBIM Studio — paridade Vanilla / React

## Estado verificável nesta revisão do PR #4

- Fonte canônica: SQLite em Engenharia360, mesmo endereço e esquema; NÃO migrar, recriar ou limpar banco.
- Motor CBIM: ACadSharp, IfcOpenShell e workspace Python são invocados pelos contratos existentes, sem fork de cálculo.
- Um catálogo de 34 calculadoras é importado por Vanilla e React, com validação independente e persistência existentes.
- React em \`?renderer=react\`: cria/lista obras e registros de etapa/pendência/RDO/material/frente; cria estudos BIM; importa IFC/JSON; executa análise, visualizador, DWG e ações de conflitos; consulta workspaces; executa cálculos.
- Retido: renderer Vanilla como padrão. \`?renderer=legacy\` permanece explícito.
- Revisão do WorkspaceStore ainda inicia outra janela Electron. Isso NÃO comprova aplicação unificada.
- Operação agora possui formulários React para frentes, subfrentes, checklist, medições, compras, contratos, aditivos e orçamento. Financeiro agora possui contas, DRE simples e folha. Ainda faltam paridade de edições avançadas, RDO completo, relatórios especializados, visualização estrutural 3D e comparação detalhada de cada fluxo com a Vanilla.
- NÃO remover \`app/src/main.js\`, \`standaloneBimUi.js\`, \`bimUi.js\` ou alterar o default para React enquanto a lista de lacunas permanecer.

## Critérios obrigatórios antes de merge

1. Mapear cada tela, formulário, cálculo, visualização, exportação, operação e evento da Vanilla e reproduzir em React.
2. Incorporar StudioApp e API local sob uma só navegação/Janela Electron, mantendo isolamento, token de sessão e defesa contra navegação externa.
3. Testar round-trip SQLite/backup/projetos antigos, histórico e recuperação sem sobrescrita.
4. Garantir E2E de DWG real, IFC, clash, decisões humanas, estado recuperado e visualizadores (inclusive 3D).
5. Testar painel financeiro e operação completa, incluindo os fluxos e relatórios.
6. Executar \`npm test\`, regressão Python CBIM/SDK, build Vite e NSIS no Windows. Inspecionar logs e artefato de instalação do PR #4.
7. Remover Vanilla **somente** após paridade comprovada, e então atualizar default e empacotamento. Não mesclar PR #4 com qualquer etapa pendente.

Dependências de runtime: open source / local / self-hosted, sem API paga silenciosa. CI é disparado manualmente/por label \`run-cbim-qa\`, não por cada commit.
