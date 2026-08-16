const TIPOS_ELEMENTO = Object.freeze(['pilar', 'viga', 'laje', 'fundacao', 'parede', 'escada']);
const COMBINACOES = Object.freeze(['permanente', 'acidental', 'vento', 'elu', 'els']);

function numeroPositivo(valor, campo, permitirZero = false) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || (permitirZero ? numero < 0 : numero <= 0)) throw new Error(`${campo} deve ser um número ${permitirZero ? 'não negativo' : 'positivo'}.`);
  return numero;
}

export function validarModeloEstrutural(modelo = {}) {
  if (!String(modelo.nome ?? '').trim()) throw new Error('O modelo estrutural precisa de um nome.');
  return { nome: String(modelo.nome).trim(), norma: modelo.norma ? String(modelo.norma).trim() : null, unidade: modelo.unidade || 'kN-m', status: modelo.status || 'rascunho' };
}

export function validarPavimentoEstrutural(pavimento = {}) {
  if (!String(pavimento.nome ?? '').trim()) throw new Error('O pavimento precisa de um nome.');
  return { nome: String(pavimento.nome).trim(), nivel: numeroPositivo(pavimento.nivel ?? 0, 'Nível', true), altura: numeroPositivo(pavimento.altura ?? 3, 'Altura') };
}

export function validarElementoEstrutural(elemento = {}) {
  if (!TIPOS_ELEMENTO.includes(elemento.tipo)) throw new Error(`Tipo de elemento inválido: ${elemento.tipo}.`);
  if (!String(elemento.nome ?? '').trim()) throw new Error('O elemento precisa de um nome.');
  return { tipo: elemento.tipo, nome: String(elemento.nome).trim(), material: elemento.material ? String(elemento.material).trim() : null, secao: elemento.secao ?? {}, geometria: elemento.geometria ?? {}, status: elemento.status || 'rascunho' };
}

export function validarCargaEstrutural(carga = {}) {
  if (!String(carga.tipo ?? '').trim()) throw new Error('A carga precisa de um tipo.');
  const valor = numeroPositivo(carga.valor, 'Valor da carga', true);
  if (!String(carga.unidade ?? '').trim()) throw new Error('A carga precisa de uma unidade.');
  if (carga.combinacao && !COMBINACOES.includes(carga.combinacao)) throw new Error(`Combinação inválida: ${carga.combinacao}.`);
  return { tipo: String(carga.tipo).trim(), descricao: carga.descricao ? String(carga.descricao).trim() : null, valor, unidade: String(carga.unidade).trim(), combinacao: carga.combinacao || 'permanente' };
}

export { TIPOS_ELEMENTO, COMBINACOES };
