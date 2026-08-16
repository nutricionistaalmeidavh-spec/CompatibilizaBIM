import assert from 'node:assert/strict';
import test from 'node:test';
import { criarManifestoEstruturalViewer } from '../src/bim/structuralViewerAdapter.js';

test('converte modelo estrutural em manifesto visualizável', () => { const result = criarManifestoEstruturalViewer({ nome: 'Torre', nos: [{ id: 'a', x: 0, y: 0, z: 0 }, { id: 'b', x: 3, y: 0, z: 3 }], elementos: [{ id: 'v1', nome: 'Viga inclinada', tipo: 'viga', nodeI: 'a', nodeJ: 'b' }] }); assert.equal(result.elementos.length, 1); assert.deepEqual(result.elementos[0].bbox.min, [-0.03, -0.03, -0.03]); });
