import test from 'node:test';
import assert from 'node:assert/strict';
import { reconciliarFinanceiroObra } from '../src/domain/financialReconciliation.js';
test('F7 DRE separates accrued cash, approved measurements and pending invoices',()=>{
 const r=reconciliarFinanceiroObra({
  entries:[{obra_id:'A',tipo:'receita',status:'confirmado',valor:100},{obra_id:'A',tipo:'receita',status:'previsto',valor:200},{obra_id:'A',tipo:'receita',status:'recebido',valor:90},{obra_id:'A',tipo:'despesa',status:'pago',valor:40},{obra_id:'A',tipo:'despesa',status:'previsto',valor:60},{obra_id:null,tipo:'despesa',status:'pago',valor:1000}],
  measures:[{status:'aprovada',quantidade:2,preco_unitario:30},{status:'rascunho',quantidade:10,preco_unitario:100}],
  purchases:[{valor_total:200,recebido:2,quantidade:4,pagamento_status:'pendente'}],
  contracts:[{valor:100,aditivos:[{valor:20}]}],
  obraId:'A'
 });
 assert.equal(r.receitasPrevistas,390);
 assert.equal(r.receitasConfirmadas,190);
 assert.equal(r.despesasPagas,40);
 assert.equal(r.medicoesAprovadas,60);
 assert.equal(r.contratado,120);
 assert.equal(r.comprasAReceber,2);
 assert.equal(r.receitasRecebidas,90);
 assert.equal(r.saldoCaixaRegistrado,50);
 assert.equal(r.indicadoresSaoEstimativas,true);
});
test('F7 invalid monetary input never contaminates totals',()=>{
 assert.throws(()=>reconciliarFinanceiroObra({obraId:'A',entries:[{obra_id:'A',tipo:'despesa',valor:NaN}]}),/financeiro/i);
});
