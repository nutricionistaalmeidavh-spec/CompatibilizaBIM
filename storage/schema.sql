PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS obras (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cliente TEXT,
  endereco TEXT,
  responsavel_tecnico TEXT,
  status TEXT NOT NULL DEFAULT 'planejamento',
  data_inicio TEXT,
  data_previsao_termino TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

-- Modelo estrutural global: base para análise de edifícios, sem alterar as calculadoras existentes.
CREATE TABLE IF NOT EXISTS modelos_estruturais (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  norma TEXT,
  unidade TEXT NOT NULL DEFAULT 'kN-m',
  status TEXT NOT NULL DEFAULT 'rascunho',
  versao INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pavimentos_estruturais (
  id TEXT PRIMARY KEY,
  modelo_id TEXT NOT NULL REFERENCES modelos_estruturais(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  nivel REAL NOT NULL DEFAULT 0,
  altura REAL NOT NULL DEFAULT 3,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nos_estruturais (
  id TEXT PRIMARY KEY,
  modelo_id TEXT NOT NULL REFERENCES modelos_estruturais(id) ON DELETE CASCADE,
  pavimento_id TEXT REFERENCES pavimentos_estruturais(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL DEFAULT 0,
  apoio_ux INTEGER NOT NULL DEFAULT 0,
  apoio_uy INTEGER NOT NULL DEFAULT 0,
  apoio_uz INTEGER NOT NULL DEFAULT 0,
  apoio_rx INTEGER NOT NULL DEFAULT 0,
  apoio_ry INTEGER NOT NULL DEFAULT 0,
  apoio_rz INTEGER NOT NULL DEFAULT 0,
  carga_fx REAL NOT NULL DEFAULT 0,
  carga_fy REAL NOT NULL DEFAULT 0,
  carga_fz REAL NOT NULL DEFAULT 0,
  carga_mx REAL NOT NULL DEFAULT 0,
  carga_my REAL NOT NULL DEFAULT 0,
  carga_mz REAL NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS elementos_estruturais (
  id TEXT PRIMARY KEY,
  modelo_id TEXT NOT NULL REFERENCES modelos_estruturais(id) ON DELETE CASCADE,
  pavimento_id TEXT REFERENCES pavimentos_estruturais(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  nome TEXT NOT NULL,
  material TEXT,
  secao_json TEXT NOT NULL DEFAULT '{}',
  geometria_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'rascunho',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cargas_estruturais (
  id TEXT PRIMARY KEY,
  modelo_id TEXT NOT NULL REFERENCES modelos_estruturais(id) ON DELETE CASCADE,
  elemento_id TEXT REFERENCES elementos_estruturais(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT,
  valor REAL NOT NULL,
  unidade TEXT NOT NULL,
  combinacao TEXT NOT NULL DEFAULT 'permanente',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_modelos_estruturais_obra ON modelos_estruturais(obra_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pavimentos_estruturais_modelo ON pavimentos_estruturais(modelo_id, nivel);
CREATE INDEX IF NOT EXISTS idx_nos_estruturais_modelo ON nos_estruturais(modelo_id, nome);
CREATE INDEX IF NOT EXISTS idx_elementos_estruturais_modelo ON elementos_estruturais(modelo_id, tipo);
CREATE INDEX IF NOT EXISTS idx_cargas_estruturais_modelo ON cargas_estruturais(modelo_id, combinacao);

CREATE TABLE IF NOT EXISTS etapas (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  percentual_peso REAL NOT NULL DEFAULT 0,
  percentual_concluido REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'nao_iniciada',
  responsavel TEXT
);

CREATE TABLE IF NOT EXISTS pendencias (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'media',
  responsavel TEXT,
  prazo TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  origem TEXT NOT NULL DEFAULT 'obra'
);

CREATE TABLE IF NOT EXISTS rdos (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  turno TEXT,
  responsavel TEXT NOT NULL,
  dados_json TEXT NOT NULL,
  status_aprovacao TEXT NOT NULL DEFAULT 'rascunho',
  aprovado_por TEXT,
  aprovado_em TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calculos (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  entradas_json TEXT NOT NULL,
  resultados_json TEXT NOT NULL,
  norma TEXT,
  versao TEXT NOT NULL,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS materiais_obra (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  unidade TEXT,
  quantidade_planejada REAL NOT NULL DEFAULT 0,
  quantidade_realizada REAL NOT NULL DEFAULT 0,
  custo_unitario REAL NOT NULL DEFAULT 0,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documentos_obra (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  dados_base64 TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS historico_obra (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  acao TEXT NOT NULL,
  detalhes_json TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bim_modelos (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  disciplina TEXT NOT NULL DEFAULT 'não definida',
  arquivo_nome TEXT NOT NULL,
  arquivo_hash TEXT,
  arquivo_base64 TEXT,
  revisao INTEGER NOT NULL DEFAULT 1,
  elementos_json TEXT NOT NULL DEFAULT '[]',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bim_analises (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  modelo_a_id TEXT NOT NULL REFERENCES bim_modelos(id),
  modelo_b_id TEXT NOT NULL REFERENCES bim_modelos(id),
  modo TEXT NOT NULL,
  tolerancia REAL NOT NULL DEFAULT 0.002,
  afastamento REAL NOT NULL DEFAULT 0.05,
  status TEXT NOT NULL DEFAULT 'concluida',
  conflitos_json TEXT NOT NULL DEFAULT '[]',
  criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_etapas_obra ON etapas(obra_id);
CREATE INDEX IF NOT EXISTS idx_pendencias_obra ON pendencias(obra_id);
CREATE INDEX IF NOT EXISTS idx_rdos_obra_data ON rdos(obra_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_bim_modelos_obra ON bim_modelos(obra_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_bim_analises_obra ON bim_analises(obra_id, criado_em DESC);

-- Espaços BIM independentes: o módulo pode trabalhar sem cadastro de obra.
-- obra_id é apenas um vínculo opcional para quando o usuário desejar relacionar o estudo.
CREATE TABLE IF NOT EXISTS bim_projetos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  obra_id TEXT REFERENCES obras(id) ON DELETE SET NULL,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bim_modelos_avulsos (
  id TEXT PRIMARY KEY,
  projeto_id TEXT NOT NULL REFERENCES bim_projetos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  disciplina TEXT NOT NULL DEFAULT 'não definida',
  arquivo_nome TEXT NOT NULL,
  arquivo_hash TEXT,
  arquivo_base64 TEXT,
  revisao INTEGER NOT NULL DEFAULT 1,
  elementos_json TEXT NOT NULL DEFAULT '[]',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bim_analises_avulsas (
  id TEXT PRIMARY KEY,
  projeto_id TEXT NOT NULL REFERENCES bim_projetos(id) ON DELETE CASCADE,
  modelo_a_id TEXT NOT NULL REFERENCES bim_modelos_avulsos(id),
  modelo_b_id TEXT NOT NULL REFERENCES bim_modelos_avulsos(id),
  modo TEXT NOT NULL,
  tolerancia REAL NOT NULL DEFAULT 0.002,
  afastamento REAL NOT NULL DEFAULT 0.05,
  status TEXT NOT NULL DEFAULT 'concluida',
  conflitos_json TEXT NOT NULL DEFAULT '[]',
  criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bim_projetos_atualizado ON bim_projetos(atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_bim_modelos_avulsos_projeto ON bim_modelos_avulsos(projeto_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_bim_analises_avulsas_projeto ON bim_analises_avulsas(projeto_id, criado_em DESC);

-- Núcleo operacional reutilizável sem depender do software Fluxo DRE.
CREATE TABLE IF NOT EXISTS frentes_servico (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  responsavel TEXT,
  status TEXT NOT NULL DEFAULT 'ativa',
  percentual_concluido REAL NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subfrentes_servico (
  id TEXT PRIMARY KEY,
  frente_id TEXT NOT NULL REFERENCES frentes_servico(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativa',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_frente (
  id TEXT PRIMARY KEY,
  frente_id TEXT NOT NULL REFERENCES frentes_servico(id) ON DELETE CASCADE,
  subfrente_id TEXT REFERENCES subfrentes_servico(id) ON DELETE SET NULL,
  item TEXT NOT NULL,
  pavimento TEXT,
  responsavel TEXT,
  prazo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  percentual_concluido REAL NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS medicoes_servico (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id TEXT REFERENCES frentes_servico(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 0,
  preco_unitario REAL NOT NULL DEFAULT 0,
  periodo TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contratos_obra (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  fornecedor TEXT NOT NULL,
  objeto TEXT NOT NULL,
  valor REAL NOT NULL DEFAULT 0,
  inicio TEXT,
  fim TEXT,
  status TEXT NOT NULL DEFAULT 'vigente',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aditivos_contrato (
  id TEXT PRIMARY KEY,
  contrato_id TEXT NOT NULL REFERENCES contratos_obra(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL DEFAULT 0,
  data TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compras_pedidos (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id TEXT REFERENCES frentes_servico(id) ON DELETE SET NULL,
  fornecedor TEXT NOT NULL,
  descricao TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 0,
  unidade TEXT,
  valor_total REAL NOT NULL DEFAULT 0,
  recebido REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'solicitado',
  pagamento_status TEXT NOT NULL DEFAULT 'pendente',
  pedido_em TEXT NOT NULL,
  recebido_em TEXT,
  pago_em TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orcamento_itens (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  frente_id TEXT REFERENCES frentes_servico(id) ON DELETE SET NULL,
  periodo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  planejado REAL NOT NULL DEFAULT 0,
  realizado REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planejado',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
  id TEXT PRIMARY KEY,
  obra_id TEXT REFERENCES obras(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL DEFAULT 0,
  vencimento TEXT,
  status TEXT NOT NULL DEFAULT 'previsto',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folha_pagamentos (
  id TEXT PRIMARY KEY,
  obra_id TEXT REFERENCES obras(id) ON DELETE SET NULL,
  colaborador TEXT NOT NULL,
  periodo TEXT NOT NULL,
  funcao TEXT,
  valor_bruto REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'previsto',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_frentes_obra ON frentes_servico(obra_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_subfrentes_frente ON subfrentes_servico(frente_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_checklist_frente ON checklist_frente(frente_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_medicoes_obra ON medicoes_servico(obra_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_obra ON contratos_obra(obra_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_aditivos_contrato ON aditivos_contrato(contrato_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_compras_obra ON compras_pedidos(obra_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_orcamento_obra_periodo ON orcamento_itens(obra_id, periodo, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_obra ON lancamentos_financeiros(obra_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_folha_obra ON folha_pagamentos(obra_id, atualizado_em DESC);

-- Contexto de navegação local: mantém a obra/frente/período escolhidos entre telas e reinicializações.
CREATE TABLE IF NOT EXISTS workspace_context (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  obra_id TEXT REFERENCES obras(id) ON DELETE SET NULL,
  frente_id TEXT REFERENCES frentes_servico(id) ON DELETE SET NULL,
  periodo_inicio TEXT,
  periodo_fim TEXT,
  bim_mode TEXT NOT NULL DEFAULT 'independente',
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS module_links (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  entity_id TEXT,
  obra_id TEXT REFERENCES obras(id) ON DELETE CASCADE,
  frente_id TEXT REFERENCES frentes_servico(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  criado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_module_links_obra ON module_links(obra_id, criado_em DESC);
