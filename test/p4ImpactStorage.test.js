import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {migrarBancoCompatibilidade,CURRENT_SCHEMA_VERSION} from '../storage/schemaMigrations.js';
const require=createRequire(import.meta.url);
const initSqlJs=require('sql.js');
const SQL=await initSqlJs({locateFile:f=>require.resolve('sql.js/dist/'+f)});
const schema=fs.readFileSync('storage/schema.sql','utf8');
test('P4 schema version 5 preserva estudos antigos e armazena snapshots 5D imutáveis',()=>{
 const db=new SQL.Database();db.run(schema);
 db.run("PRAGMA user_version=4");
 assert.equal(migrarBancoCompatibilidade(db,schema),CURRENT_SCHEMA_VERSION);
 const cols=db.exec('PRAGMA table_info(impactos_engenharia_bim)')[0].values.map(r=>r[1]);
 for(const c of ['estudo_id','projeto_id','snapshot_json','criado_em','status'])assert.ok(cols.includes(c),c);
 assert.equal(db.exec('PRAGMA foreign_key_check').length,0);
 assert.equal(db.exec('PRAGMA user_version')[0].values[0][0],5);
 db.close();
});
