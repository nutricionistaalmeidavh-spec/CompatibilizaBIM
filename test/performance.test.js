import assert from 'node:assert/strict';
import test from 'node:test';
import { analisarPorticoEspacial3D } from '../src/analysis/portal3d.js';

test('processa modelo espacial maior sem perder estabilidade', () => {
  const nos = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, x: i, y: 0, z: 0, supports: i === 0 ? { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true } : { uy: true, uz: true, rx: true, ry: true, rz: true }, loads: i === 19 ? { fx: 100 } : {} }));
  const elementos = nos.slice(0, -1).map((_, i) => ({ id: `e${i}`, nodeI: `n${i}`, nodeJ: `n${i + 1}`, E: 200e9, A: 0.01, I: 1e-5, J: 2e-5 }));
  const result = analisarPorticoEspacial3D({ nos, elementos });
  assert.equal(result.dofCount, 120);
  assert.equal(result.elements.length, 19);
});
