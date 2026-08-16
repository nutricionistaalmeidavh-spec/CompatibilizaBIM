const gravidadeLabels = Object.freeze({ high: 'Alta', medium: 'Média', low: 'Baixa' });

export function normalizarGravidade(conflito = {}) {
  if (conflito.gravidade && gravidadeLabels[conflito.gravidade]) return conflito.gravidade;
  if (Number(conflito.distanciaM ?? 0) === 0) return 'high';
  if (Number(conflito.distanciaM ?? 0) <= 0.05) return 'medium';
  return 'low';
}

export function explicarConflitoBim(conflito = {}) {
  const gravidade = normalizarGravidade(conflito);
  const a = conflito.aNome || conflito.aGlobalId || 'Elemento A';
  const b = conflito.bNome || conflito.bGlobalId || 'Elemento B';
  const distancia = Number(conflito.distanciaM ?? 0);
  const localizacao = Array.isArray(conflito.ponto) ? conflito.ponto.map((v) => Number(v).toFixed(2)).join(', ') : 'não informada';
  const tipo = conflito.modo === 'clearance' ? 'afastamento insuficiente' : conflito.modo === 'collision' ? 'colisão geométrica' : 'interseção geométrica';
  return {
    gravidade,
    gravidadeLabel: gravidadeLabels[gravidade],
    titulo: `${a} × ${b}`,
    resumo: `Foi identificada ${tipo} entre os dois elementos.`,
    detalhe: distancia === 0 ? 'Os volumes ocupam a mesma região.' : `A distância mínima calculada é ${distancia.toFixed(3)} m.`,
    localizacao: `Ponto aproximado (X, Y, Z): ${localizacao}`,
    recomendacao: gravidade === 'high' ? 'Verifique a solução antes de liberar a próxima revisão.' : 'Confirme a tolerância de projeto e registre a decisão na revisão.'
  };
}

export function resumirModeloBim(modelo = {}) {
  const elementos = modelo.elementos ?? [];
  const classes = [...new Set(elementos.map((item) => item.ifcClass).filter(Boolean))];
  return {
    disciplina: modelo.disciplina || 'Não definida',
    elementos: elementos.length,
    classes: classes.length ? classes.join(', ') : 'classes não informadas',
    revisao: modelo.revisao ?? 1,
    arquivo: modelo.arquivo_nome || modelo.nome || 'arquivo não informado'
  };
}
