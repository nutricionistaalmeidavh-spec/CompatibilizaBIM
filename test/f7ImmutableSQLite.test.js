import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {migrarBancoCompatibilidade} from '../storage/schemaMigrations.js';
import {salvarRdo,atualizarRdo,aprovarRdo,excluirRdo,salvarMedicao,atualizarStatusMedicao} from '../storage/sqliteStore.js';
const require=createRequire(import.meta.url), initSqlJs=require('sql.js');
const SQL=await initSqlJs({locateFile:f=>require.resolve('sql.js/dist/'+f)});
const schema=fs.readFileSync('storage/schema.sql','utf8');
test('F7 approved RDO is immutable and retains approval evidence; measurements cannot be reopened',()=>{
 const db=new SQL.Database();migrarBancoCompatibilidade(db,schema);
 const columns=db.exec('PRAGMA table_info(obras)')[0].values.map(row=>row[1]);
 db.run('INSERT INTO obras (id,codigo,nome,status,criado_em,atualizado_em) VALUES (?,?,?,?,?,?)',['obra1','O1','Obra QA','execucao','2026-10-12','2026-10-12']);
 const previous=globalThis.engineeringStorage;globalThis.engineeringStorage={saveSync:()=>true};
 try{
  const id=salvarRdo(db,'obra1',{data:'2026-10-12',responsavel:'Coordenação',servicosExecutados:[{descricao:'Instalar tubulação'}]});
  aprovarRdo(db,id,'Engenheiro responsável');
  assert.throws(()=>atualizarRdo(db,id,{data:'2026-10-12',responsavel:'Outra pessoa'}),/imutável/i);
  assert.throws(()=>excluirRdo(db,id,'EXCLUIR'),/não pode ser excluído/i);
  assert.throws(()=>aprovarRdo(db,id,'Outro'),/já foi aprovado/);
  assert.equal(db.exec('SELECT aprovado_por FROM rdos WHERE id = ?',[id])[0].values[0][0],'Engenheiro responsável');
  assert.equal(db.exec("SELECT COUNT(*) FROM historico_obra WHERE entidade = 'rdo' AND acao = 'aprovado'")[0].values[0][0],1);
  const m=salvarMedicao(db,'obra1',{descricao:'Teste',quantidade:1,precoUnitario:10,periodo:'2026-10'});
  atualizarStatusMedicao(db,m,'conferida');atualizarStatusMedicao(db,m,'aprovada');
  assert.throws(()=>atualizarStatusMedicao(db,m,'rascunho'),/imutável/i);
 }finally{globalThis.engineeringStorage=previous;db.close();}
});
