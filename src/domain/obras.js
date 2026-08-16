const STATUS_OBRA = Object.freeze(['planejamento', 'em_andamento', 'pausada', 'concluida', 'cancelada']);
const STATUS_ETAPA = Object.freeze(['nao_iniciada', 'em_andamento', 'bloqueada', 'concluida']);

export class ObraValidationError extends Error {
  constructor(errors) {
    super(`Obra inválida: ${errors.join('; ')}`);
    this.name = 'ObraValidationError';
    this.errors = errors;
  }
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function dataIso(value, field, errors, { required = false } = {}) {
  if (value == null || value === '') {
    if (required) errors.push(`${field} é obrigatório`);
    return value ?? null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) errors.push(`${field} deve ser uma data válida`);
  return value;
}

function validarObraInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['dados da obra são obrigatórios'];
  if (!String(input.nome ?? '').trim()) errors.push('nome é obrigatório');
  if (!String(input.codigo ?? '').trim()) errors.push('codigo é obrigatório');
  if (input.status && !STATUS_OBRA.includes(input.status)) errors.push(`status deve ser: ${STATUS_OBRA.join(', ')}`);
  dataIso(input.dataInicio, 'dataInicio', errors);
  dataIso(input.dataPrevisaoTermino, 'dataPrevisaoTermino', errors);
  return errors;
}

export function criarObra(input) {
  const errors = validarObraInput(input);
  if (errors.length) throw new ObraValidationError(errors);
  const agora = new Date().toISOString();
  return {
    id: input.id ?? id('obra'),
    codigo: String(input.codigo).trim(),
    nome: String(input.nome).trim(),
    cliente: String(input.cliente ?? '').trim() || null,
    endereco: String(input.endereco ?? '').trim() || null,
    responsavelTecnico: String(input.responsavelTecnico ?? '').trim() || null,
    status: input.status ?? 'planejamento',
    dataInicio: input.dataInicio ?? null,
    dataPrevisaoTermino: input.dataPrevisaoTermino ?? null,
    etapas: [],
    rdos: [],
    pendencias: [],
    criadoEm: input.criadoEm ?? agora,
    atualizadoEm: agora,
  };
}

export function adicionarEtapa(obra, input) {
  if (!String(input?.nome ?? '').trim()) throw new ObraValidationError(['nome da etapa é obrigatório']);
  const etapa = {
    id: input.id ?? id('etapa'),
    nome: String(input.nome).trim(),
    descricao: String(input.descricao ?? '').trim() || null,
    percentualPeso: Number(input.percentualPeso ?? 0),
    status: input.status ?? 'nao_iniciada',
    percentualConcluido: Number(input.percentualConcluido ?? 0),
    responsavel: String(input.responsavel ?? '').trim() || null,
  };
  if (!STATUS_ETAPA.includes(etapa.status)) throw new ObraValidationError([`status da etapa deve ser: ${STATUS_ETAPA.join(', ')}`]);
  if (!Number.isFinite(etapa.percentualPeso) || etapa.percentualPeso < 0 || etapa.percentualPeso > 100) throw new ObraValidationError(['percentualPeso deve estar entre 0 e 100']);
  if (!Number.isFinite(etapa.percentualConcluido) || etapa.percentualConcluido < 0 || etapa.percentualConcluido > 100) throw new ObraValidationError(['percentualConcluido deve estar entre 0 e 100']);
  return { ...obra, etapas: [...(obra.etapas ?? []), etapa], atualizadoEm: new Date().toISOString() };
}

export function atualizarEtapa(obra, etapaId, patch) {
  let encontrou = false;
  const etapas = (obra.etapas ?? []).map((etapa) => {
    if (etapa.id !== etapaId) return etapa;
    encontrou = true;
    const atualizada = { ...etapa, ...patch };
    if (atualizada.status && !STATUS_ETAPA.includes(atualizada.status)) throw new ObraValidationError([`status da etapa deve ser: ${STATUS_ETAPA.join(', ')}`]);
    if (atualizada.percentualConcluido < 0 || atualizada.percentualConcluido > 100) throw new ObraValidationError(['percentualConcluido deve estar entre 0 e 100']);
    return atualizada;
  });
  if (!encontrou) throw new ObraValidationError(['etapa não encontrada']);
  return { ...obra, etapas, atualizadoEm: new Date().toISOString() };
}

export function adicionarPendencia(obra, input) {
  if (!String(input?.descricao ?? '').trim()) throw new ObraValidationError(['descricao da pendência é obrigatória']);
  const pendencia = {
    id: input.id ?? id('pend'),
    descricao: String(input.descricao).trim(),
    prioridade: input.prioridade ?? 'media',
    responsavel: String(input.responsavel ?? '').trim() || null,
    prazo: input.prazo ?? null,
    status: input.status ?? 'aberta',
    origem: input.origem ?? 'obra',
  };
  return { ...obra, pendencias: [...(obra.pendencias ?? []), pendencia], atualizadoEm: new Date().toISOString() };
}

export function atualizarStatusObra(obra, status) {
  if (!STATUS_OBRA.includes(status)) throw new ObraValidationError([`status deve ser: ${STATUS_OBRA.join(', ')}`]);
  return { ...obra, status, atualizadoEm: new Date().toISOString() };
}

export function resumoObra(obra) {
  const etapas = obra.etapas ?? [];
  const pesoTotal = etapas.reduce((total, etapa) => total + etapa.percentualPeso, 0);
  const progresso = pesoTotal > 0
    ? etapas.reduce((total, etapa) => total + etapa.percentualConcluido * etapa.percentualPeso, 0) / pesoTotal
    : 0;
  return {
    etapasTotal: etapas.length,
    etapasConcluidas: etapas.filter((etapa) => etapa.status === 'concluida').length,
    percentualConcluido: Math.round(progresso * 100) / 100,
    pendenciasAbertas: (obra.pendencias ?? []).filter((item) => item.status !== 'resolvida').length,
    rdosRegistrados: (obra.rdos ?? []).length,
  };
}

export { STATUS_OBRA, STATUS_ETAPA };
