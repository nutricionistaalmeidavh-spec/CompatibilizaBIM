import test from 'node:test';
import assert from 'node:assert/strict';
import { analisarPorticoPlano2D } from '../src/analysis/frame2d.js';

test('resolve deslocamento de uma viga em balanço 2D', () => {
  const E = 200e6; const I = 8e-5; const A = 0.02; const length = 4; const load = -10;
  const resultado = analisarPorticoPlano2D({
    nos: [
      { id: 'N1', x: 0, y: 0, supports: { ux: true, uy: true, rz: true } },
      { id: 'N2', x: length, y: 0, loads: { fy: load } },
    ],
    elementos: [{ id: 'V1', nodeI: 'N1', nodeJ: 'N2', E, A, I }],
  });
  const deslocamentoEsperado = load * length ** 3 / (3 * E * I);
  const rotacaoEsperada = load * length ** 2 / (2 * E * I);
  assert.ok(Math.abs(resultado.displacement.N2.uy - deslocamentoEsperado) < 1e-9);
  assert.ok(Math.abs(resultado.displacement.N2.rz - rotacaoEsperada) < 1e-9);
  assert.equal(resultado.elements.length, 1);
});

test('rejeita pórtico sem apoios ou com elemento inválido', () => {
  assert.throws(() => analisarPorticoPlano2D({ nos: [{ id: 'N1', x: 0, y: 0 }, { id: 'N2', x: 1, y: 0 }], elementos: [{ id: 'V1', nodeI: 'N1', nodeJ: 'N2', E: 1, A: 1, I: 1 }] }), /apoio/);
  assert.throws(() => analisarPorticoPlano2D({ nos: [{ id: 'N1', x: 0, y: 0, supports: { ux: true } }, { id: 'N2', x: 0, y: 0 }], elementos: [{ id: 'V1', nodeI: 'N1', nodeJ: 'N2', E: 1, A: 1, I: 1 }] }), /comprimento nulo/);
});
