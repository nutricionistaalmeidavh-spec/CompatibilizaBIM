import assert from 'node:assert/strict';
import test from 'node:test';
import { analisarModeloEspacial3D } from '../src/analysis/frame3d.js';

test('resolve barra espacial axial com deslocamento em Z', () => {
  const result = analisarModeloEspacial3D({
    nos: [
      { id: 'base', x: 0, y: 0, z: 0, supports: { x: true, y: true, z: true } },
      { id: 'topo', x: 0, y: 0, z: 3, supports: { x: true, y: true }, loads: { fz: 1000 } },
    ],
    elementos: [{ id: 'barra', nodeI: 'base', nodeJ: 'topo', E: 200000000000, A: 0.01 }],
  });
  assert.ok(Math.abs(result.displacement.topo.uz - 0.0000015) < 1e-12);
  assert.ok(Math.abs(result.elements[0].axialForce - 1000) < 1e-6);
});

test('rejeita modelo espacial sem estabilidade', () => {
  assert.throws(() => analisarModeloEspacial3D({ nos: [{ id: 'a', x: 0, y: 0, z: 0 }, { id: 'b', x: 1, y: 0, z: 0 }], elementos: [{ id: 'e', nodeI: 'a', nodeJ: 'b', E: 1, A: 1 }] }), /apoio/);
});
