// Catálogo de pontos de entrada reutilizados do Fluxo DRE.
// O código de cada software continua isolado; este catálogo apenas descreve
// os módulos que podem ser ativados no Engenharia 360.
export const dreModules = Object.freeze([
  { id: 'obras', group: 'Operação', label: 'Obras', description: 'Cadastro, avanço e visão geral das obras.' },
  { id: 'frentes', group: 'Operação', label: 'Frentes de serviço', description: 'Organização das equipes e frentes ativas.' },
  { id: 'orcamento', group: 'Operação', label: 'Orçamento', description: 'Custos planejados, realizados e curva S.' },
  { id: 'planejamento', group: 'Operação', label: 'Planejamento', description: 'Etapas, prazos e marcos do cronograma.' },
  { id: 'rdo', group: 'Operação', label: 'Diário de obra', description: 'RDO, ocorrências, equipes e evidências.' },
  { id: 'medicoes', group: 'Operação', label: 'Medições', description: 'Medições de serviços e aprovações.' },
  { id: 'compras', group: 'Operação', label: 'Compras e materiais', description: 'Insumos, pedidos e recebimentos.' },
  { id: 'contratos', group: 'Operação', label: 'Contratos e aditivos', description: 'Contratos, escopo e aditivos.' },
  { id: 'tarefas', group: 'Operação', label: 'Tarefas', description: 'Pendências operacionais e responsáveis.' },
  { id: 'painel', group: 'Financeiro', label: 'Painel', description: 'Indicadores consolidados do negócio.' },
  { id: 'dre', group: 'Financeiro', label: 'DRE', description: 'Demonstrativo de resultado por período e obra.' },
  { id: 'contas', group: 'Financeiro', label: 'Contas', description: 'Contas a pagar, receber e fluxo de caixa.' },
  { id: 'folha', group: 'Financeiro', label: 'Folha e pagamentos', description: 'Folha, equipes e pagamentos.' }
]);

export function listarModulosDre() { return dreModules.slice(); }
