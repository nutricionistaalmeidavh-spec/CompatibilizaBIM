// Separates recorded revenue/expenses, approved measurements and purchasing commitments.
// This is NOT a bank-conciliated statement nor a statutory accrual-based DRE.
const finite=(value,label)=>{const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('Valor financeiro inválido: '+label);return n;};
const sum=(list,key)=>list.reduce((s,e)=>s+finite(e[key]??0,key),0);
export function reconciliarFinanceiroObra({obraId,entries=[],measures=[],purchases=[],contracts=[]}={}){
 const local=entries.filter(e=>e.obra_id===obraId);
 const incoming=local.filter(e=>e.tipo==='receita'),outgoing=local.filter(e=>e.tipo==='despesa');
 const receitasPrevistas=sum(incoming,'valor'),despesasPrevistas=sum(outgoing,'valor');
 const receitasConfirmadas=sum(incoming.filter(e=>['confirmado','recebido','pago'].includes(e.status)),'valor');
 const receitasRecebidas=sum(incoming.filter(e=>e.status==='recebido'),'valor');
 const despesasPagas=sum(outgoing.filter(e=>e.status==='pago'),'valor');
 const medicoesAprovadas=measures.filter(m=>m.status==='aprovada').reduce((s,m)=>s+finite(m.quantidade,'quantidade')*finite(m.preco_unitario,'preco_unitario'),0);
 const contratado=contracts.reduce((s,c)=>s+finite(c.valor,'contrato')+sum(c.aditivos||[],'valor'),0);
 const comprasAReceber=purchases.reduce((s,p)=>s+Math.max(0,finite(p.quantidade,'quantidade compra')-finite(p.recebido,'recebimento')),0);
 const comprasPendentesPagamento=sum(purchases.filter(p=>p.pagamento_status!=='pago'),'valor_total');
 return {receitasPrevistas,despesasPrevistas,receitasConfirmadas,receitasRecebidas,despesasPagas,
   saldoCaixaRegistrado:receitasRecebidas-despesasPagas,medicoesAprovadas,contratado,comprasAReceber,
   comprasPendentesPagamento,indicadoresSaoEstimativas:true,
   observacao:'Saldo calculado apenas de lançamentos locais confirmados/pagos. Não prova movimentação bancária, competência contábil nem recebimento de medição.'};
}
