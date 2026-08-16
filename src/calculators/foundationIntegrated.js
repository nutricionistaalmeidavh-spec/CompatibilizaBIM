// Verificações preliminares integradas de fundação e solo–estrutura.
// Unidades: cargas em kN, dimensões em m, tensões em kPa.
export function calcularFundacaoIntegrada(input = {}) {
  const n = Number(input.cargaVertical); const area = Number(input.areaBase); const capacidade = Number(input.tensaoAdmissivelSolo); const k = Number(input.coeficienteRecalque); const limite = Number(input.recalqueLimite ?? 0.025); const momento = Number(input.momento ?? 0); const modulo = Number(input.moduloReacao ?? k);
  if (![n, area, capacidade, modulo, limite].every(Number.isFinite) || n <= 0 || area <= 0 || capacidade <= 0 || modulo <= 0 || limite <= 0) throw new Error('Carga, área, solo, módulo de reação e limite devem ser positivos.');
  const tensaoMedia = n / area; const excentricidade = momento / n; const tensaoMax = tensaoMedia * (1 + 6 * Math.abs(excentricidade) / Math.sqrt(area)); const tensaoMin = tensaoMedia * (1 - 6 * Math.abs(excentricidade) / Math.sqrt(area)); const recalque = tensaoMedia / modulo; const utilizacao = tensaoMax / capacidade;
  return { resultados: { tensaoMedia, tensaoMax, tensaoMin, recalque, excentricidade, utilizacao }, verificacoes: { capacidade: tensaoMax <= capacidade, contato: tensaoMin >= 0, recalque: recalque <= limite }, metadados: { modelo: 'fundação integrada preliminar', avisos: ['Não substitui sondagem, parâmetros geotécnicos, análise de estabilidade global ou responsabilidade técnica.'] } };
}
