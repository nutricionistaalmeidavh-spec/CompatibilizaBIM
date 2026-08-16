export class RdoValidationError extends Error {
  constructor(errors) {
    super(`RDO inválido: ${errors.join('; ')}`);
    this.name = 'RdoValidationError';
    this.errors = errors;
  }
}

function id() {
  return `rdo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function validar(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['dados do RDO são obrigatórios'];
  if (!input.data) errors.push('data é obrigatória');
  if (!String(input.responsavel ?? '').trim()) errors.push('responsavel é obrigatório');
  if (input.data && Number.isNaN(new Date(input.data).getTime())) errors.push('data deve ser válida');
  return errors;
}

function texto(value) {
  return String(value ?? '').trim() || null;
}

export function criarRdo(input) {
  const errors = validar(input);
  if (errors.length) throw new RdoValidationError(errors);
  return {
    id: input.id ?? id(),
    data: input.data,
    turno: input.turno ?? null,
    responsavel: String(input.responsavel).trim(),
    clima: {
      condicao: texto(input.clima?.condicao),
      temperatura: input.clima?.temperatura ?? null,
      impactoNaObra: texto(input.clima?.impactoNaObra),
    },
    equipes: (input.equipes ?? []).map((item) => ({
      funcao: String(item.funcao ?? '').trim(),
      quantidade: Number(item.quantidade ?? 0),
      observacao: texto(item.observacao),
    })),
    servicosExecutados: (input.servicosExecutados ?? []).map((item) => ({
      descricao: String(item.descricao ?? '').trim(),
      etapaId: item.etapaId ?? null,
      percentualAvanco: item.percentualAvanco ?? null,
      local: texto(item.local),
      observacao: texto(item.observacao),
    })),
    materiaisRecebidos: (input.materiaisRecebidos ?? []).map((item) => ({
      material: String(item.material ?? '').trim(),
      quantidade: item.quantidade ?? null,
      unidade: texto(item.unidade),
      fornecedor: texto(item.fornecedor),
      observacao: texto(item.observacao),
    })),
    ocorrencias: (input.ocorrencias ?? []).map((item) => ({
      descricao: String(item.descricao ?? '').trim(),
      impacto: item.impacto ?? 'medio',
      acaoTomada: texto(item.acaoTomada),
    })),
    impedimentos: (input.impedimentos ?? []).map((item) => ({
      descricao: String(item.descricao ?? '').trim(),
      responsavel: texto(item.responsavel),
      prazo: item.prazo ?? null,
      resolvido: Boolean(item.resolvido),
    })),
    fotos: (input.fotos ?? []).map((item) => ({
      uri: String(item.uri ?? '').trim(),
      legenda: texto(item.legenda),
      local: texto(item.local),
    })),
    observacoes: texto(input.observacoes),
    criadoEm: input.criadoEm ?? new Date().toISOString(),
  };
}

export function registrarRdo(obra, rdoInput) {
  const rdo = criarRdo(rdoInput);
  return { ...obra, rdos: [...(obra.rdos ?? []), rdo], atualizadoEm: new Date().toISOString() };
}

export function resumoRdo(rdo) {
  const equipeTotal = (rdo.equipes ?? []).reduce((total, item) => total + item.quantidade, 0);
  return {
    equipeTotal,
    servicosRegistrados: (rdo.servicosExecutados ?? []).length,
    materiaisRecebidos: (rdo.materiaisRecebidos ?? []).length,
    ocorrencias: (rdo.ocorrencias ?? []).length,
    impedimentosAbertos: (rdo.impedimentos ?? []).filter((item) => !item.resolvido).length,
    fotos: (rdo.fotos ?? []).length,
  };
}
