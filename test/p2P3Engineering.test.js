import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararVinculoBim, estadoVinculoBim } from '../src/engineering/contextualStudies.js';

const model=(id,revision=1)=>({id,nome:id,revisao:revision,arquivo_hash:id+'-hash-'+revision,elementos:[{id:'pipe-1',globalId:'G-1'}]});
const project=(m=model('m-1'))=>({id:'p1',nome:'Estudo',obra_id:null,modelos:[m,{...model('m-2'),elementos:[]}],analises:[
  {id:'a1',modelo_a_id:'m-1',modelo_b_id:'m-2',modelos_json:'["m-1","m-2"]',
   conflitos:[{chave:'c1',modelos:['m-1','m-2'],aGlobalId:'G-1',bGlobalId:'G-2',fingerprint:'fp1',status:'aberto'}]}
]});

test('P2 vincula análise, modelo, revisão, GUID e pendência com snapshot imutável',()=>{
 const p=project(),link=prepararVinculoBim({project:p,modeloId:'m-1',analiseId:'a1',conflitoChave:'c1',elementoRef:'G-1'});
 assert.equal(link.projetoId,'p1');
 assert.equal(link.modeloId,'m-1');
 assert.equal(link.revisao,1);
 assert.equal(link.arquivoHash,'m-1-hash-1');
 assert.equal(link.analiseId,'a1');
 assert.equal(link.conflitoChave,'c1');
 assert.equal(link.elementoRef,'G-1');
 assert.equal(estadoVinculoBim(link,p).atual,true);
 assert.equal(estadoVinculoBim(link,project(model('m-1',2))).atual,false);
});
test('P2 nunca aceita associação a modelo, GUID ou conflito não comprovado',()=>{
 const p=project();
 assert.throws(()=>prepararVinculoBim({project:p,modeloId:'forged'}),/modelo/i);
 assert.throws(()=>prepararVinculoBim({project:p,modeloId:'m-1',elementoRef:'G-unknown'}),/elemento/i);
 assert.throws(()=>prepararVinculoBim({project:p,modeloId:'m-1',analiseId:'a-unknown'}),/análise/i);
 assert.throws(()=>prepararVinculoBim({project:p,modeloId:'m-1',analiseId:'a1',conflitoChave:'missing'}),/conflito/i);
 assert.throws(()=>prepararVinculoBim({project:p,modeloId:'m-2',analiseId:'a1',conflitoChave:'c1',elementoRef:'G-1'}),/elemento/i);
});
test('P2 só aceita projeto vinculado à obra coerente, sem vincular silenciosamente',()=>{
 const p={...project(),obra_id:'work-a'};
 assert.throws(()=>prepararVinculoBim({project:p,modeloId:'m-1',obraId:'work-b'}),/obra/i);
 assert.equal(prepararVinculoBim({project:p,modeloId:'m-1',obraId:null}).obraId,'work-a');
});

import { compararAlternativas, buscarDimensionamentoInverso } from '../src/engineering/inverseDesign.js';
import { CALCULADORAS } from '../app/src/calculatorCatalog.js';

const entry=CALCULADORAS.vigaBiapoiada;
const args=Object.fromEntries(entry.fields.map(([k,,v])=>[k,v]));
const limit=[{path:'esforcos.momento',operator:'<=',limit:70}];

test('P3 procura menor vão viável amostrado, sem prometer ótimo global',()=>{
 const result=buscarDimensionamentoInverso({definition:entry,calculatorId:'vigaBiapoiada',inputs:args,variableKey:'vaoM',min:3,max:6,constraints:limit});
 assert.equal(result.status,'viavel_amostrado');
 assert.ok(result.candidato.entradas.vaoM>=3&&result.candidato.entradas.vaoM<=6);
 assert.ok(result.candidato.avaliacao.viavel);
 assert.equal(result.candidato.verificacao.ok,true);
 assert.equal(result.amostras.length,41);
 assert.match(result.metodo,/amostr/i);
});
test('P3 restrições impossíveis não geram falsa solução',()=>{
 const result=buscarDimensionamentoInverso({definition:entry,calculatorId:'vigaBiapoiada',inputs:args,variableKey:'vaoM',min:3,max:6,constraints:[{path:'esforcos.momento',operator:'<=',limit:-1}]});
 assert.equal(result.status,'nao_encontrado');
 assert.equal(result.candidato,null);
});
test('P3 impede métrica inválida, limites vazios, ajustes não canônicos',()=>{
 assert.throws(()=>buscarDimensionamentoInverso({definition:entry,calculatorId:'vigaBiapoiada',inputs:args,variableKey:'fake',min:1,max:5,constraints:limit}),/parâmetro/i);
 assert.throws(()=>buscarDimensionamentoInverso({definition:entry,calculatorId:'vigaBiapoiada',inputs:args,variableKey:'vaoM',min:6,max:3,constraints:limit}),/limites/i);
 assert.throws(()=>buscarDimensionamentoInverso({definition:entry,calculatorId:'vigaBiapoiada',inputs:args,variableKey:'vaoM',min:1,max:5,constraints:[{path:'__proto__.x',operator:'<=',limit:10}]}),/grandeza/i);
 assert.throws(()=>compararAlternativas({definition:entry,calculatorId:'vigaBiapoiada',inputs:args,scenarios:[{nome:'insegura',ajustes:{unknown:2}}],constraints:limit}),/parâmetro/i);
});
test('P3 comparação aplica motor original, oráculo e restrições a todas as alternativas',()=>{
 const comparison=compararAlternativas({definition:entry,calculatorId:'vigaBiapoiada',inputs:args,
    scenarios:[{nome:'Base',ajustes:{}},{nome:'Vão menor',ajustes:{vaoM:4}}],constraints:limit});
 assert.equal(comparison.length,2);
 assert.ok(comparison.every(s=>s.verificacao.ok));
 assert.equal(comparison[0].avaliacao.viavel,false);
 assert.equal(comparison[1].avaliacao.viavel,true);
 assert.equal(comparison[0].resultados.esforcos.momento,87.5);
});
