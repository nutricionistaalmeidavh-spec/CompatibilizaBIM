import { calcularFundacaoIntegrada } from '../calculators/foundationIntegrated.js';

export function integrarFundacoesAoModelo(modelo = {}, opcoes = {}) {
  const areaBase = Number(opcoes.areaBase ?? 4); const tensaoAdmissivelSolo = Number(opcoes.tensaoAdmissivelSolo ?? 180); const moduloReacao = Number(opcoes.moduloReacao ?? 20000); const recalqueLimite = Number(opcoes.recalqueLimite ?? 0.025);
  const apoios = (modelo.nos ?? []).filter((node) => node.supports?.ux || node.supports?.uy || node.supports?.uz);
  if (!apoios.length) throw new Error('O modelo não possui nós de apoio para integrar fundações.');
  return apoios.map((node) => { const loads = node.loads ?? {}; const cargaVertical = Math.max(Math.abs(Number(loads.fz ?? loads.fy ?? 0)), 0.001); return { noId: node.id, noNome: node.nome ?? node.id, verificacao: calcularFundacaoIntegrada({ cargaVertical, areaBase, tensaoAdmissivelSolo, moduloReacao, recalqueLimite, momento: Number(loads.mx ?? loads.mz ?? 0) }) }; });
}
