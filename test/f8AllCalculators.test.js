import test from 'node:test';
import assert from 'node:assert/strict';
import { CALCULADORAS } from '../app/src/calculatorCatalog.js';
import { validarCalculoIndependente, listarCoberturaOraculos } from '../src/validation/independentOracle.js';
const all=Object.entries(CALCULADORAS);
test('F8 34 calculators have explicitly identified oracles, not universal finite-only approval',()=>{
 assert.equal(all.length,34);
 assert.deepEqual(listarCoberturaOraculos().sort(),all.map(([key])=>key).sort());
});
for(const [id,definition] of all){
 test('F8 '+id+' default numerical result gets an independent verdict and mutated key is rejected',()=>{
  const input=Object.fromEntries(definition.fields.map(([key,,value])=>[key,value]));
  const args=id==='orcamentoCronograma'?{etapas:[{nome:'Fundações',valor:input.fundacoesValor,inicio:input.fundacoesInicio,fim:input.fundacoesFim},{nome:'Estrutura',valor:input.estruturaValor,inicio:input.estruturaInicio,fim:input.estruturaFim}]}:input;
  const result=definition.fn(args);
  const ok=validarCalculoIndependente(id,args,result);
  assert.equal(ok.ok,true,JSON.stringify({id,errors:ok.errors,checks:ok.verificacoes}));
  assert.ok(ok.verificacoes?.length>=1, id+' lacks verified independent check');
  const clone=structuredClone(result);
  const outputPath=ok.verificacoes[0].campo.split('.');
  let at=clone;
  for(const key of outputPath.slice(0,-1))at=at[key];
  const k=outputPath.at(-1);
  assert.equal(typeof at[k],'number',id+' oracle must reference an actual numeric result');
  at[k]=Number.isFinite(at[k])?at[k]+Math.max(1,Math.abs(at[k])*2):1234;
  const fail=validarCalculoIndependente(id,args,clone);
  assert.equal(fail.ok,false,id+' missed tampered result');
 });
}
test('F8 unknown calculators never receive independent certification',()=>{
 const x=validarCalculoIndependente('engine-not-reviewed',{x:1},{resultados:{n:1}});
 assert.equal(x.ok,false);
 assert.match(x.errors.join(' '),/sem oráculo/i);
});
