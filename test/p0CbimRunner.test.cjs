const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDwgRequest, parseCbimBatch } = require('../app/electron/cbimRunner.cjs');

test('bloqueia nome com formato não DWG e disciplina inválida', () => {
  assert.throws(() => parseDwgRequest({ name: '../x.exe', discipline: 'hydraulic', base64: 'QQ==' }), /DWG válido/);
  assert.throws(() => parseDwgRequest({ name: 'x.dwg', discipline: 'unknown', base64: 'QQ==' }), /disciplina válida/);
});
test('bloqueia bytes em base64 inválidos', () => {
  assert.throws(() => parseDwgRequest({ name: 'x.dwg', discipline: 'fire', base64: '::::' }), /base64 inválido/);
});
test('normaliza nome seguro sem escapar pasta do job', () => {
  const request = parseDwgRequest({ name: '../projeto.dwg', discipline: 'hydraulic', base64: 'QUJDRA==' });
  assert.equal(request.filename, 'projeto.dwg');
  assert.equal(request.bytes.toString(), 'ABCD');
});
test('recusa relatório sem comprovação do provider real', () => {
  assert.throws(() => parseCbimBatch({ reports: [{ discipline:'fire', provider:'fixture', import_coverage:1, ifc_sanity_passed:true }] }, 'fire'), /ACadSharp/);
});
test('aceita relatório real com pendências sem confundir com precisão', () => {
  const report = parseCbimBatch({ reports: [{discipline:'hydraulic',provider:'acadsharp',import_coverage:.96,ifc_sanity_passed:true,review_pending_count:1312}] }, 'hydraulic');
  assert.equal(report.review_pending_count, 1312);
});
