import test from 'node:test';
import assert from 'node:assert/strict';
import { federarModelos, reconciliarConflitos, validarConfiguracaoFederacao, validarDecisaoConflito } from '../src/bim/p2Coordination.js';
const model=(id,x)=>({id,nome:id,arquivo_nome:id+'.json',arquivo_hash:id+'-v1',revisao:1,disciplina:'hydraulic',elementos:[{id:'e-'+id,bbox:{min:[x,0,0],max:[x+2,1,1]}}]});
test('F4 N model pairs are all analyzed, never just the first two',async()=>{
 const a=[model('a',0),model('b',1),model('c',1.5)];
 const r=await federarModelos(a,{modo:'intersection',tolerancia:0.002}, {analisarManifestos:async([x,y])=>[{aGlobalId:x.id,bGlobalId:y.id,ponto:[1,0,0]}]});
 assert.equal(r.pairs.length,3);assert.equal(r.conflitos.length,3);
 assert.equal(r.motor,'manifesto_bbox');assert.ok(r.conflitos.every(x=>x.modo==='intersection'&&x.chave&&x.modelos.length===2));
});
test('F4 mixed IFC/manifest cannot claim real geometry and negative tolerance fails closed',async()=>{
 await assert.rejects(()=>federarModelos([model('a',0),{...model('b',1),arquivo_nome:'b.ifc',arquivo_base64:'QUJD'}],{},{}),/mesmo formato/);
 assert.throws(()=>validarConfiguracaoFederacao({tolerancia:-1}),/tolerância/);
});
test('F4 decision survives identical evidence but not a changed revision; old issue not silently resolved',()=>{
 const old=[{chave:'issue1',fingerprint:'A@v1+B@v1',status:'em_revisao',responsavel:'Engenheira',comentarios:[{texto:'Conferir'}]}];
 const result=reconciliarConflitos([{chave:'issue1',fingerprint:'A@v1+B@v1'},{chave:'issue2',fingerprint:'B@v1+C@v1'}],old);
 assert.equal(result[0].status,'em_revisao');assert.equal(result[0].responsavel,'Engenheira');
 assert.equal(result[1].status,'aberto');
 const changed=reconciliarConflitos([{chave:'issue1',fingerprint:'A@v2+B@v1'}],old);
 assert.equal(changed[0].status,'aberto');assert.equal(changed[0].revisaoAlterada,true);
});

test('F4 require accountable decision and nonempty ignore reason',()=>{
 assert.throws(()=>validarDecisaoConflito({status:'resolvido',responsavel:''}),/responsável/);
 assert.throws(()=>validarDecisaoConflito({status:'ignorado',responsavel:'Equipe',motivo:''}),/motivo/);
 assert.equal(validarDecisaoConflito({status:'em_revisao',responsavel:'Equipe',prazo:'2026-11-02'}).status,'em_revisao');
 assert.throws(()=>validarDecisaoConflito({status:'resolved'}),/Estado/);
});
