import assert from 'node:assert/strict';
import test from 'node:test';
import { gerarPdfRelatorio } from '../app/src/pdfTemplates.js';

test('gera PDF com acentos em WinAnsi, sem sequencias UTF-8 corrompidas', async () => {
  const blob = gerarPdfRelatorio('Mem\u00f3ria de c\u00e1lculo', { 'Se\u00e7\u00e3o': ['Tens\u00e3o admiss\u00edvel: 12,5 MPa'] });
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.includes(Buffer.from([0xf3])), true);
  assert.equal(bytes.includes(Buffer.from([0xe1])), true);
  assert.equal(bytes.includes(Buffer.from([0xc7])), true);
  assert.equal(bytes.includes(Buffer.from([0xc3, 0xa9])), false);
});
