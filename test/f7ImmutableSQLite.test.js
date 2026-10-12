import test from 'node:test';import assert from 'node:assert/strict';
import {garantirRdoMutavel,garantirMedicaoTransicao} from '../src/domain/approvalGuards.js';
test('F7 RDO approval cannot be silently edited or deleted',()=>{
 assert.equal(garantirRdoMutavel('rascunho'),true);
 assert.throws(()=>garantirRdoMutavel('aprovado'),/imutável/i);
});
test('F7 measure approval cannot revert and rejected records require reconference',()=>{
 assert.equal(garantirMedicaoTransicao('rascunho','conferida'),true);
 assert.equal(garantirMedicaoTransicao('conferida','aprovada'),true);
 assert.throws(()=>garantirMedicaoTransicao('aprovada','rascunho'),/imutável/i);
 assert.throws(()=>garantirMedicaoTransicao('rejeitada','aprovada'),/conferência/i);
 assert.throws(()=>garantirMedicaoTransicao('rascunho','pagamento'),/inválida/i);
});
