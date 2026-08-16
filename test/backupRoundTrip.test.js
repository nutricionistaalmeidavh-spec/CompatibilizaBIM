import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { validarContratoBackup } from '../src/storage/backupContract.js';

const require = createRequire(import.meta.url);

test('faz round-trip do backup SQLite sem perder dados da obra', async () => {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({ locateFile: (file) => require.resolve(`sql.js/dist/${file}`) });
  const schema = fs.readFileSync(path.resolve('storage/schema.sql'), 'utf8');
  const primeiro = new SQL.Database();
  primeiro.run(schema);
  primeiro.run("INSERT INTO obras (id,codigo,nome,status,criado_em,atualizado_em) VALUES ('obra-teste','T-001','Obra de backup','execucao','2026-08-15','2026-08-15')");
  const base64 = Buffer.from(primeiro.export()).toString('base64');
  const contrato = JSON.stringify({ versao: 1, exportadoEm: '2026-08-15', bancoBase64: base64 });
  assert.equal(validarContratoBackup(contrato).valido, true);
  const restaurado = new SQL.Database(Buffer.from(JSON.parse(contrato).bancoBase64, 'base64'));
  const row = restaurado.exec("SELECT codigo,nome FROM obras WHERE id='obra-teste'")[0].values[0];
  assert.deepEqual(row, ['T-001', 'Obra de backup']);
  primeiro.close(); restaurado.close();
});
