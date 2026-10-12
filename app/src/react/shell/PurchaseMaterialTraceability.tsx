import React from 'react';
import {listarMateriais,listarModuleLinks,salvarModuleLink,registrarHistorico,salvarBanco} from '../../../../storage/sqliteStore.js';
import {MATERIAL_LINK,parseTraceLink,prepareMaterialLink,summarizePurchaseMaterialTrace} from '../../../../src/domain/p1Traceability.js';
type Props={db:any;obraId:string;purchases:any[];onChange:()=>void};
const number=(x:any)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(Number(x)||0);
export function PurchaseMaterialTraceability({db,obraId,purchases,onChange}:Props){
 const [actor,setActor]=React.useState(''),[selected,setSelected]=React.useState<Record<string,string>>({});
 const [error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const materials=listarMateriais(db,obraId),links=listarModuleLinks(db,obraId).filter((r:any)=>r.module_id===MATERIAL_LINK);
 const summaries=summarizePurchaseMaterialTrace(purchases,materials,links);
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
   {!purchases.length&&<p>Não há compras visíveis neste contexto.</p>}
   {!materials.length&&<p>Cadastre o material na seção Obras antes de associá-lo a um pedido de compra.</p>}
   {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="cbim-react-error">{error}</p>}
 </div>;
}
