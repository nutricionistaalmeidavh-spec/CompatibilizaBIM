import { analisarPorticoPlano2D } from './frame2d.js';

export function analisarModeloEstruturalPlano(modelo = {}) {
  const elementos = (modelo.elementos ?? []).filter((item) => item.tipo === 'viga' || item.tipo === 'pilar').map((item) => ({
    id: item.id,
    nodeI: item.geometria?.nodeI ?? item.geometria?.noInicial,
    nodeJ: item.geometria?.nodeJ ?? item.geometria?.noFinal,
    E: item.material?.E ?? item.material?.moduloElasticidade ?? 200000000,
    A: item.secao?.A ?? item.secao?.area ?? 0.01,
    I: item.secao?.I ?? item.secao?.inercia ?? 1e-5,
  }));
  if (elementos.some((item) => !item.nodeI || !item.nodeJ)) throw new Error('Cada elemento precisa indicar os nós inicial e final.');
  return analisarPorticoPlano2D({ nos: modelo.nos ?? [], elementos });
}
