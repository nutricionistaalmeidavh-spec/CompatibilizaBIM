import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { migrarBancoCompatibilidade, CURRENT_SCHEMA_VERSION } from '../storage/schemaMigrations.js';
const require=createRequire(import.meta.url);
const initSqlJs=require('sql.js');
const SQL=await initSqlJs({locateFile:f=>require.resolve('sql.js/dist/'+f)});
const schema=fs.readFileSync('storage/schema.sql','utf8');

test('P2 evolui SQLite sem alterar memórias antigas e cria relação contextual tipada',()=>{
 const db=new SQL.Database();
 db.run(schema);
 db.run("INSERT INTO obras (id,codigo,nome,criado_em,atualizado_em) VALUES ('obra','O1','Obra','2024','2024')");
 db.run("INSERT INTO calculos (id,obra_id,tipo,titulo,entradas_json,resultados_json,versao,criado_em) VALUES ('old','obra','vigaBiapoiada','Antigo','{}','{}','0.1.0','2024')");
 db.run("PRAGMA user_version=3");
 assert.equal(migrarBancoCompatibilidade(db,schema),CURRENT_SCHEMA_VERSION);
 assert.equal(db.exec("SELECT COUNT(*) FROM calculos WHERE id='old'")[0].values[0][0],1);
 const columns=db.exec('PRAGMA table_info(estudos_engenharia_bim)')[0].values.map(row=>row[1]);
 for(const field of ['projeto_id','modelo_id','analise_id','conflito_chave','elemento_ref','contexto_json','alternativas_json'])assert.ok(columns.includes(field),field);
 assert.equal(db.exec('PRAGMA foreign_key_check').length,0);
 db.close();
});
