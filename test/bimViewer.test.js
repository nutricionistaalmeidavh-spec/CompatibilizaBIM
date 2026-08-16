import test from 'node:test';
import assert from 'node:assert/strict';
import { criarManifestoViewer, gerarViewerFederadoHtml } from '../src/bim/viewer.js';

test('gera manifesto federado com disciplinas e conflitos', () => {
  const manifesto = criarManifestoViewer([{ nome: 'estrutura.ifc', disciplina: 'Estrutura', elementos: [{ globalId: 'A', bbox: { min: [0, 0, 0], max: [1, 1, 1] } }] }, { nome: 'hidraulica.ifc', disciplina: 'Hidráulica', elementos: [{ globalId: 'B', bbox: { min: [1, 1, 1], max: [2, 2, 2] } }] }], [{ aGlobalId: 'A', bGlobalId: 'B' }]);
  const html = gerarViewerFederadoHtml(manifesto);
  assert.deepEqual(manifesto.disciplines, ['Estrutura', 'Hidráulica']);
  assert.match(html, /Viewer BIM federado/);
  assert.match(html, /A/);
  assert.match(html, /getContext\('webgl'/);
  assert.match(html, /canvas id="gl"/);
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new Function(match[1]));
});
