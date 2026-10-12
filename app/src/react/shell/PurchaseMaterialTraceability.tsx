import React from 'react';
import {listarMateriais,listarLancamentosFinanceiros,listarModuleLinks,salvarModuleLink,registrarHistorico,salvarBanco} from '../../../../storage/sqliteStore.js';
import {MATERIAL_LINK,FINANCE_LINK,parseTraceLink,prepareMaterialLink,preparePurchaseFinanceLink,summarizePurchaseMaterialTrace,summarizePurchaseFinanceTrace} from '../../../../src/domain/p1Traceability.js';
type Props={db:any;obraId:string;purchases:any[];onChange:()=>void};
const number=(x:any)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(Number(x)||0);
export function PurchaseMaterialTraceability({db,obraId,purchases,onChange}:Props){
 const [actor,setActor]=React.useState(''),[selected,setSelected]=React.useState<Record<string,string>>({}),[selectedCost,setSelectedCost]=React.useState<Record<string,string>>({});
 const [error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const materials=listarMateriais(db,obraId),links=listarModuleLinks(db,obraId).filter((r:any)=>r.module_id===MATERIAL_LINK);
 const summaries=summarizePurchaseMaterialTrace(purchases,materials,links);
 const entries=listarLancamentosFinanceiros(db,obraId).filter((e:any)=>e.obra_id===obraId&&e.tipo==='despesa');
 const financeLinks=listarModuleLinks(db,obraId).filter((r:any)=>r.module_id===FINANCE_LINK);
 const financeTraces=summarizePurchaseFinanceTrace(purchases,entries,financeLinks);
 const unavailableExpenses=new Set(financeLinks.map((l:any)=>parseTraceLink(l)?.entryId).filter(Boolean));
 const linkedMaterials=links.map((r:any)=>parseTraceLink(r)).filter(Boolean);
 const save=(purchase:any)=>{
  setNotice('');setError('');
  try{
   const material=materials.find((m:any)=>m.id===selected[purchase.id]);
   if(!material)throw Error('Selecione um material cadastrado na obra.');
   const data=prepareMaterialLink(obraId,purchase,material,links,actor);
   salvarModuleLink(db,data);
   registrarHistorico(db,obraId,'compra_material',purchase.id,'vinculo_registrado',{materialId:material.id,usuario:actor});
   salvarBanco(db);
   setNotice('Compra vinculada ao cadastro de material. Nenhuma entrada de estoque, consumo, custo ou despesa foi criada.');onChange();
  }catch(e:any){setError(e.message||String(e));}
 };
 const saveExpense=(purchase:any)=>{
  setNotice('');setError('');
  try {
   const entry=entries.find((e:any)=>e.id===selectedCost[purchase.id]);
   if(!entry)throw Error('Selecione uma despesa registrada nesta obra.');
   const args=preparePurchaseFinanceLink(obraId,purchase,entry,financeLinks,actor);
   salvarModuleLink(db,args);
   registrarHistorico(db,obraId,'compra_financeiro',purchase.id,'conferencia_registrada',{lancamentoId:entry.id,usuario:actor,valorCompra:purchase.valor_total,valorLancamento:entry.valor});
   salvarBanco(db);
   setNotice('Conferência da despesa registrada: status e valores mantidos sem alterações.');onChange();
  }catch(e:any){setError(e.message||String(e));}
 };
 return <div className="cbim-react-panel" aria-label="Rastreabilidade de compras e materiais">
   <h2>Rastreabilidade · compras e materiais</h2>
   <p>Relaciona o pedido ao material já registrado na obra, mantendo separados quantidade comprada, recebida e consumo informado. O status de pagamento não prova lançamento financeiro; nenhuma alteração ocorre automaticamente.</p>
   <label>Responsável pelo vínculo<input placeholder="Nome de quem conferiu" value={actor} onChange={e=>setActor(e.target.value)}/></label>
   {summaries.map(r=>{
    const purchase=purchases.find((p:any)=>p.id===r.purchaseId);
    const options=materials.filter((m:any)=>String(m.unidade||'').toLowerCase()===String(purchase.unidade||'').toLowerCase());
    return <article key={r.purchaseId}><b>{purchase.fornecedor} · {purchase.descricao}</b>
     <p>Pedido: {number(r.expectedQuantity)} {r.unit} · recebido: {number(r.receivedQuantity)} · a receber: {number(r.pendingReceipt)} · pagamento: {r.paymentStatus}</p>
     {r.state==='rastreada'?<p>Material associado: {r.materialName} · consumo informado: {number(r.registeredConsumption)} {r.unit} (não é baixa automática)</p>:<>
      {r.state==='referencia_invalida'&&<p role="status">Referência de material desatualizada. Nenhum novo vínculo foi criado.</p>}
      {r.state==='nao_vinculada'&&<div className="cbim-react-form-grid"><label>Material da obra<select value={selected[purchase.id]||''} onChange={e=>setSelected(v=>({...v,[purchase.id]:e.target.value}))}><option value="">Selecionar material</option>{options.map((m:any)=><option value={m.id} key={m.id}>{m.material} · {m.unidade}</option>)}</select></label>
       <button type="button" disabled={!actor.trim()||!selected[purchase.id]} onClick={()=>save(purchase)}>Vincular para conferência</button></div>}
     </>}
    </article>;
   })}
   <h3>Conferência financeira da compra (sem lançamento automático)</h3>
   <p>O vínculo identifica a despesa já cadastrada para conferência, sem criar outra, alterar o pagamento ou presumir que o banco confirmou a movimentação. Uma despesa é associada a apenas um pedido nesta etapa.</p>
   {financeTraces.map(trace=>{
    const purchase=purchases.find((p:any)=>p.id===trace.purchaseId);
    return <article key={'finance-'+trace.purchaseId}><b>{purchase.descricao} · {trace.state==='conferida'?'Referência conferida':trace.state==='divergente'?'Divergência a revisar':trace.state==='referencia_invalida'?'Referência ausente':'Sem despesa vinculada'}</b>
      <p>Valor da compra: R$ {number(trace.purchaseAmount)} · despesa vinculada: {trace.recordedExpenseAmount==null?'—':'R$ '+number(trace.recordedExpenseAmount)} · pagamento no pedido: {trace.paymentStatus} · status no financeiro: {trace.ledgerStatus||'—'}</p>
      {trace.state==='divergente'&&<p role="status">Diferença de valor R$ {number(trace.delta)} ou situação de pagamento incompatível. Confira os registros originais antes de considerar o custo conciliado.</p>}
      {trace.state==='nao_vinculada'&&<div className="cbim-react-form-grid">
       <label>Despesa da obra<select aria-label={'Despesa para '+purchase.descricao} value={selectedCost[purchase.id]||''} onChange={e=>setSelectedCost(v=>({...v,[purchase.id]:e.target.value}))}>
        <option value="">Selecionar lançamento existente</option>
        {entries.filter((e:any)=>!unavailableExpenses.has(e.id)).map((e:any)=><option key={e.id} value={e.id}>{e.descricao} · R$ {number(e.valor)} · {e.status}</option>)}
       </select></label>
       <button type="button" disabled={!actor.trim()||!selectedCost[purchase.id]} onClick={()=>saveExpense(purchase)}>Vincular despesa existente</button>
      </div>}
     </article>;
   })}
   {!purchases.length&&<p>Não há compras visíveis neste contexto.</p>}
   {!materials.length&&<p>Cadastre o material na seção Obras antes de associá-lo a um pedido de compra.</p>}
   {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="cbim-react-error">{error}</p>}
 </div>;
}
