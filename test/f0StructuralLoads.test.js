import test from 'node:test';
import assert from 'node:assert/strict';
import { analisarModeloEstruturalPlano,analisarModeloEstruturalEspacial } from '../src/analysis/structuralModelAdapter.js';
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`expected ${a} close to ${b}`);
const makeModel=(loads=[])=>({
  unidade:'kN-m',
  nos:[
    {id:'a',nome:'A',x:0,y:0,z:0,supports:{ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}},
    {id:'b',nome:'B',x:4,y:0,z:0,supports:{}}
  ],
  elementos:[{id:'beam',nome:'V1',tipo:'viga',geometria:{nodeI:'A',nodeJ:'B'},material:{E:200e6},secao:{A:.02,I:8e-5,Iy:8e-5,Iz:8e-5,J:1.6e-4}}],
  cargas:loads
});
const item=(tipo,valor,unidade,combinacao='permanente')=>({id:'load',elemento_id:'beam',tipo,valor,unidade,combinacao});
test('F0-03: 2D cantilever uniform beam load is actually applied: u = qL^4/(8EI)',()=>{
  const model=makeModel([item('distribuida',-5,'kN/m')]);
  const solved=analisarModeloEstruturalPlano(model);
  near(solved.displacement.b.uy,-5*4**4/(8*200e6*8e-5));
  assert.equal(solved.loadCase,'permanente');
  assert.equal(solved.appliedLoads.length,1);
});
test('F0-03: 2D concentrated transverse load at middle of span has analytic tip deflection',()=>{
  const solved=analisarModeloEstruturalPlano(makeModel([item('concentrada',-10,'kN')]));
  near(solved.displacement.b.uy,-10*2**2*(3*4-2)/(6*200e6*8e-5));
});
test('F0-03: 2D concentrated moment at midspan produces nonzero and signed tip movement',()=>{
  const negative=analisarModeloEstruturalPlano(makeModel([item('momento',-10,'kN.m')])).displacement.b.uy;
  const positive=analisarModeloEstruturalPlano(makeModel([item('momento',10,'kN.m')])).displacement.b.uy;
  assert.ok(Math.abs(negative)>1e-7);near(negative,-positive);
});
test('F0-03: 3D horizontal cantilever uniform global Y load has analytic displacement',()=>{
  const solved=analisarModeloEstruturalEspacial(makeModel([item('distribuida',-5,'kN/m')]));
  near(solved.displacement.b.uy,-5*4**4/(8*200e6*8e-5));
  assert.equal(solved.appliedLoads.length,1);
});
test('F0-03: load case isolation avoids silent mixing of variable and permanent element loads',()=>{
  const model=makeModel([item('distribuida',-5,'kN/m','permanente'),{...item('concentrada',-10,'kN','variavel'),id:'other'}]);
  const permanent=analisarModeloEstruturalPlano(model,{loadCase:'permanente'});
  const variable=analisarModeloEstruturalPlano(model,{loadCase:'variavel'});
  assert.equal(permanent.appliedLoads.length,1);assert.equal(variable.appliedLoads.length,1);
  assert.notEqual(permanent.displacement.b.uy,variable.displacement.b.uy);
});
test('F0-03: unsupported load mode, units, or ambiguous global load must fail visibly',()=>{
  for(const bad of [
    item('temperatura',50,'C'),
    item('distribuida',5,'kgf/m'),
    {...item('concentrada',5,'kN'),elemento_id:null},
    {...item('concentrada',5,'kN'),elemento_id:'missing'}
  ]){
    assert.throws(()=>analisarModeloEstruturalPlano(makeModel([bad])),/não suport|unidade|elemento|referência|vínculo/i);
  }
});
test('F0-03: no silent nodal moment omissions: 3D solver includes nodal MZ',()=>{
 const m=makeModel();m.nos[1].loads={mz:-8};
 const solved=analisarModeloEstruturalEspacial(m);
 assert.ok(Math.abs(solved.displacement.b.uy)>0);
});
