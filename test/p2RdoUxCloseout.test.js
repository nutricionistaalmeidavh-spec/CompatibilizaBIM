import test from 'node:test';
import assert from 'node:assert/strict';
import {createRdoDraft,readRdoDraft,prepareRdoPayload,duplicateRdoContext} from '../src/domain/rdoEditor.js';
import {buildWorkCloseout} from '../src/domain/workCloseout.js';

const sample={
 id:'r-1',frenteId:'F1',data:'2026-10-12',turno:'Noturno',responsavel:'Engenheiro',clima:{condicao:'Seco',temperatura:24,impactoNaObra:'Nenhum'},
 equipes:[{funcao:'Encanador',quantidade:2,observacao:'Turno A'}],
 servicosExecutados:[{descricao:'Instalação; suporte',etapaId:'e-1',percentualAvanco:30,local:'Térreo'}],
 materiaisRecebidos:[{material:'Tubo PVC',quantidade:12.5,unidade:'m',fornecedor:'X'}],
 ocorrencias:[{descricao:'Sem energia',impacto:'alto',acaoTomada:'Esperou'}],
 impedimentos:[{descricao:'Elevador parado',responsavel:'Equipe',prazo:'2026-10-13',resolvido:true}],
 observacoes:'Revisar',fotos:[{uri:'data:image/png;base64,xxx',legenda:'Canteiro'}],status_aprovacao:'rascunho'
};
test('P2 form edit reconstructs structured RDO items without delimiter parsing or losing existing attributes',()=>{
 const draft=readRdoDraft(sample);
 assert.equal(draft.servicos[0].descricao,'Instalação; suporte');
 assert.equal(draft.equipes[0].quantidade,'2');
 assert.equal(draft.impedimentos[0].resolvido,true);
 const payload=prepareRdoPayload(draft,sample);
 assert.equal(payload.clima.temperatura,24);
 assert.equal(payload.frenteId,'F1','existing front metadata must survive RDO editing');
 assert.equal(payload.servicosExecutados[0].etapaId,'e-1');
 assert.equal(payload.materiaisRecebidos[0].fornecedor,'X');
 assert.equal(payload.impedimentos[0].resolvido,true);
 assert.equal(payload.fotos.length,1);
});
test('P2 validates individual input quantities and never silently coerces malformed entries into zero',()=>{
 const a=readRdoDraft(sample);a.equipes[0].quantidade='dois';
 assert.throws(()=>prepareRdoPayload(a,sample),/quantidade.*equipe/i);
 const b=readRdoDraft(sample);b.materiais[0].quantidade='-4';
 assert.throws(()=>prepareRdoPayload(b,sample),/quantidade.*material/i);
});
test('P2 empty template validates responsible, at least one service, and contains no automatic photos',()=>{
 const d=createRdoDraft('2026-10-12');
 assert.equal(d.equipes.length,0);
 assert.throws(()=>prepareRdoPayload(d),/responsável/i);
 d.responsavel='Técnico';
 assert.throws(()=>prepareRdoPayload(d),/serviço/i);
 d.servicos=[{descricao:'Vistoria'}];
 assert.deepEqual(prepareRdoPayload(d).fotos,[]);
});
test('P2 duplicate context copies only safe identification/crew, not accomplished services, materials or photos',()=>{
 const c=duplicateRdoContext(sample,'2026-10-13');
 assert.equal(c.data,'2026-10-13');
 assert.equal(c.equipes[0].funcao,'Encanador');
 assert.equal(c.responsavel,'Engenheiro');
 assert.equal(c.servicos.length,0);
 assert.equal(c.materiais.length,0);
 assert.equal(c.fotos?.length??0,0);
 assert.equal(sample.data,'2026-10-12');
});
test('P2 readout does not let an approved RDO be edited',()=>{
 assert.throws(()=>readRdoDraft({...sample,status_aprovacao:'aprovado'}),/aprovado.*imutável/i);
});

const work={
 id:'W',etapas:[{percentual_peso:60,percentual_concluido:100},{percentual_peso:40,percentual_concluido:50}],
 pendencias:[{id:'p1',status:'aberta'},{id:'p2',status:'resolvida'}],
 rdos:[{status_aprovacao:'aprovado'},{status_aprovacao:'rascunho'}],
 medicoes:[{status:'aprovada',quantidade:2,preco_unitario:50},{status:'rascunho',quantidade:10,preco_unitario:100}],
 compras:[{status:'recebido_parcial',quantidade:10,recebido:5,pagamento_status:'pago',valor_total:90}],
 documentos:[{id:'doc-1'}],materiais:[{quantidade_realizada:3,custo_unitario:7}],
 bimModelos:[{id:'legacy'}]
};
test('P2 closeout reports weighted progress and separates measurements, materials, purchase commitments',()=>{
 const result=buildWorkCloseout(work,{studyCount:2,reviewLinkCount:1,measureLinkCount:1});
 assert.equal(result.progress,80);
 assert.equal(result.approvedMeasurementValue,100);
 assert.equal(result.registeredMaterialCost,21);
 assert.equal(result.pendingReceiptCount,1);
 assert.equal(result.openIssues,1);
 assert.equal(result.approvedRdoCount,1);
 assert.equal(result.draftRdoCount,1);
 assert.equal(result.studyCount,2);
 assert.equal(result.reviewLinkCount,1);
 assert.ok(result.blockers.length>=3);
 assert.equal(result.readyForReview,false);
 assert.ok(!('totalSpent' in result));
});
test('P2 closeout is informational and refuses misleading done state with no stages or no approved RDO',()=>{
 const v=buildWorkCloseout({etapas:[],pendencias:[],rdos:[],medicoes:[],compras:[],documentos:[],materiais:[]});
 assert.equal(v.progress,null);
 assert.equal(v.readyForReview,false);
 assert.match(v.blockers.join(';'),/etapas/i);
 assert.match(v.blockers.join(';'),/RDO/i);
});
test('P2 weighted progress falls back to stated simple mean if all stage weights are zero',()=>{
 const r=buildWorkCloseout({etapas:[{percentual_concluido:25,percentual_peso:0},{percentual_concluido:75,percentual_peso:0}]});
 assert.equal(r.progress,50);
 assert.equal(r.progressBasis,'média simples (pesos não definidos)');
});

test('P2 removing prior item preserves surviving item metadata and does not inject former source into a newly added row',()=>{
 const old={...sample,servicosExecutados:[{descricao:'Primeiro',etapaId:'E1'},{descricao:'Segundo',etapaId:'E2'}]};
 const d=readRdoDraft(old);
 d.servicos.splice(0,1);
 d.servicos.push({descricao:'Terceiro'});
 const saved=prepareRdoPayload(d,old);
 assert.equal(saved.servicosExecutados[0].etapaId,'E2');
 assert.equal(saved.servicosExecutados[1].etapaId,undefined);
});
