import test from 'node:test';import assert from 'node:assert/strict';
import {reviseElement} from '../app/src/react/studio/domain.js';
const project={storeys:[{id:'floor'}],systems:[{id:'cold'}],
 elements:[{id:'p1',type:'pipe',path:[{x:1,y:0,z:0},{x:2,y:0,z:1}],diameter:.1,system_id:null,storey_id:null,review_state:'auto',source_refs:[{source_id:'x',entity_id:'1'}]}]};
test('F3 edit Z, diameter, layer references and review state without mutating source',()=>{
 const fixed=reviseElement(project,'p1',{zOffset:2,diameter:.15,storey_id:'floor',system_id:'cold',name:'Água fria'});
 assert.equal(fixed.elements[0].path[0].z,2);
 assert.equal(fixed.elements[0].path[1].z,3);
 assert.equal(fixed.elements[0].review_state,'edited');
 assert.deepEqual(fixed.elements[0].source_refs,project.elements[0].source_refs);
 assert.equal(project.elements[0].path[0].z,0);
});
test('F3 rejects inconsistent semantic edits rather than producing invalid CBIM',()=>{
 for(const c of [{diameter:0},{storey_id:'unknown'},{system_id:'unknown'},{zOffset:Infinity}])assert.throws(()=>reviseElement(project,'p1',c));
});
