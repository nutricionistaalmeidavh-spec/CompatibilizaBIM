import test from 'node:test';
import assert from 'node:assert/strict';
import { listarQuantitativosDaMemoria, simularImpacto5D } from '../src/engineering/p4Impact.js';
import {prepararVinculoBim} from '../src/engineering/contextualStudies.js';
import { gerarMemoriaBimPdf } from '../app/src/engineering/engineeringPdf.js';

const model={id:'modelo1',arquivo_nome:'structure.ifc',arquivo_hash:'hash-a',revisao:2,elementos:[{globalId:'GUID-BEAM'}]};
const project={id:'p1',modelos:[model],analises:[]};
const study={id:'s1',projeto_id:'p1',titulo:'Viga testada',calculadora_tipo:'vigaBiapoiada',criado_em:'2026-10-12T16:00:00Z',
 contexto:{projetoId:'p1',modeloId:'modelo1',revisao:2,arquivoHash:'hash-a',elementosAssinatura:prepararVinculoBim({project,modeloId:'modelo1',elementoRef:'GUID-BEAM'}).elementosAssinatura,elementoRef:'GUID-BEAM',analiseId:null,conflitoChave:null},
 entradas:{vaoM:5},resultados:{esforcos:{momento:80}},validacao:{ok:true,metodo:'oraculo',verificacoes:[{campo:'esforcos.momento'}],avisos:[]},alternativas:[],nota:'Hipotese inicial'};
const quantity={models:['structure.ifc'],generated_at:'2026-10-12T17:00:00Z',
 records:[{global_id:'GUID-BEAM',source_file:'structure.ifc',source:'ifc_qto',discipline:'Estrutura',storey:'Térreo',ifc_class:'IfcBeam',type_name:'Viga',quantity_name:'NetVolume',kind:'volume',unit:'m3',value:2.5},
 {global_id:'GUID-OTHER',source_file:'structure.ifc',source:'ifc_qto',discipline:'Estrutura',storey:'Térreo',ifc_class:'IfcBeam',type_name:'Viga',quantity_name:'NetVolume',kind:'volume',unit:'m3',value:9},
 {global_id:'GUID-BEAM',source_file:'other.ifc',source:'ifc_qto',discipline:'Estrutura',storey:'Térreo',ifc_class:'IfcBeam',type_name:'Viga',quantity_name:'NetVolume',kind:'volume',unit:'m3',value:99},
 {global_id:'GUID-BEAM',source_file:'structure.ifc',source:'geometry_fallback',discipline:'Estrutura',storey:'Térreo',ifc_class:'IfcBeam',type_name:'Viga',quantity_name:'MeshVolume',kind:'volume',unit:'m3',value:50}]};
const budget={currency:'BRL',source:'Catálogo local',reference_date:'2026-10',generated_at:'2026-10-12T18:00:00Z',
 total_cost:3500,unmatched_group_count:0,lines:[{line_id:'BUD-0001',discipline:'Estrutura',storey:'Térreo',ifc_class:'IfcBeam',type_name:'Viga',quantity_name:'NetVolume',unit:'m3',final_unit_cost:350,composition_code:'CONC-01',description:'Concreto'}]};
const calc=()=>listarQuantitativosDaMemoria({estudo:study,projeto:project,quantidades:quantity});
test('P4 dados reais: apenas QTO IFC do GUID e arquivo registrados, sem fallback de bbox',()=>{
 const r=calc();assert.equal(r.itens.length,1);assert.equal(r.itens[0].value,2.5);
 assert.equal(r.itens[0].source_file,'structure.ifc');
 assert.equal(r.revisaoConferidaAutomaticamente,false);
});
test('P4 compara quantidade proposta com preço unitário 5D existente, sem tratar preço do grupo como custo do elemento',()=>{
 const r=simularImpacto5D({estudo:study,projeto:project,quantidades:quantity,orcamento:budget,
 itemKey:calc().itens[0].itemKey,quantidadeProposta:3,confirmacaoRevisao:true});
 assert.equal(r.status,'precificado');assert.equal(r.diferencaQuantidade,0.5);
 assert.equal(r.custoDelta,175);assert.equal(r.precoUnitario,350);
 assert.equal(r.quantidadeOriginal,2.5);assert.equal(r.unidade,'m3');
 assert.equal(r.contexto.estudoId,'s1');assert.equal(r.contexto.elementoRef,'GUID-BEAM');
 assert.equal(r.precoReferencia.composicao,'CONC-01');
 assert.equal(r.advertencias.some(s=>/não altera/i.test(s)),true);
});
test('P4 nunca estima orçamento sem composição única ou quando preço não existe',()=>{
 const base={estudo:study,projeto:project,quantidades:quantity,orcamento:budget,
 itemKey:calc().itens[0].itemKey,quantidadeProposta:3,confirmacaoRevisao:true};
 const unpriced=simularImpacto5D({...base,orcamento:null});
 assert.equal(unpriced.status,'sem_preco');assert.equal(unpriced.custoDelta,null);
 const ambiguous=simularImpacto5D({...base,orcamento:{...budget,lines:[...budget.lines,{...budget.lines[0],line_id:'BUD-0002'}]}});
 assert.equal(ambiguous.status,'mapeamento_ambiguo');assert.equal(ambiguous.custoDelta,null);
});
test('P4 impede revisão não confirmada, valor inválido, QTO inventado e estudo desatualizado',()=>{
 const base={estudo:study,projeto:project,quantidades:quantity,orcamento:budget,
 itemKey:calc().itens[0].itemKey,quantidadeProposta:3,confirmacaoRevisao:true};
 assert.throws(()=>simularImpacto5D({...base,confirmacaoRevisao:false}),/revisão/i);
 assert.throws(()=>simularImpacto5D({...base,quantidadeProposta:-1}),/quantidade/i);
 assert.throws(()=>simularImpacto5D({...base,itemKey:'forged'}),/quantitativo/i);
 assert.throws(()=>simularImpacto5D({...base,projeto:{...project,modelos:[{...model,revisao:3}]}}),/revisão|alterada/i);
});
test('P4 PDF offline lista contexto, IFC, oráculo e delta precificado sem aprovar ART',async()=>{
 const impact=simularImpacto5D({estudo:study,projeto:project,quantidades:quantity,orcamento:budget,
 itemKey:calc().itens[0].itemKey,quantidadeProposta:3,confirmacaoRevisao:true});
 const pdf=gerarMemoriaBimPdf({estudo:study,projeto:project,impactos:[{id:'imp1',snapshot:impact,criado_em:'2026-10-12'}]});
 assert.equal(pdf.type,'application/pdf');
 const raw=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 for(const piece of ['%PDF-1.4','GUID-BEAM','structure.ifc','CONC-01','175','s1','preliminar'])assert.ok(raw.includes(piece),piece);
});
