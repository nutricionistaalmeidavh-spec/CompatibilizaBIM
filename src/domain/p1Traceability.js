// Cross-module traceability: references only. The source of truth stays in each module.
export const REVIEW_LINK='cbim_review_workspace';
export const MEASUREMENT_LINK='bim_measurement_reconciliation';
export const MATERIAL_LINK='purchase_material_trace';
export const FINANCE_LINK='purchase_financial_trace';
const TYPES=new Set([REVIEW_LINK,MEASUREMENT_LINK,MATERIAL_LINK,FINANCE_LINK]);
const required=(value,name)=>{const v=String(value??'').trim();if(!v)throw Error(name+' é obrigatório.');return v;};
const nonnegative=(value,name)=>{const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error(name+' inválida.');return n;};
const numeric=(value,name)=>{const n=Number(value);if(!Number.isFinite(n))throw Error(name+' inválida.');return n;};
const serialized=payload=>JSON.stringify({schema_version:1,...payload});
const exists=(row,moduleId)=>row?.module_id===moduleId;
const currentLinks=(rows,moduleId)=>rows.filter(row=>exists(row,moduleId)).map(row=>({row,detail:parseTraceLink(row)})).filter(x=>x.detail);
const sameUnit=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
const pathSafe=v=>{const path=required(v,'Caminho de workspace');if(!/^(?:[a-zA-Z]:[\\/]|\/)/.test(path)||!/(?:[\\/])studio-workspace[\\/]?$/.test(path)||/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(path))throw Error('Caminho de workspace deve ser absoluto e válido.');return path;};
export function parseTraceLink(row){
 if(!TYPES.has(row?.module_id))return null;
 try {
  const value=JSON.parse(row.source);
  if(!value||value.schema_version!==1||value.kind!==row.module_id)return null;
  return {...value,entityId:row.entity_id||null,obraId:row.obra_id||null};
 }catch{return null;}
}
export function prepareReviewLink(project,workspace,existing=[]){
 const projectId=required(project?.id,'Estudo de origem'),workspacePath=pathSafe(workspace?.path),job=required(workspace?.job,'Job CBIM');
 const revision=nonnegative(workspace?.revision,'Revisão CBIM');
 const conflicts=currentLinks(existing,REVIEW_LINK).filter(x=>x.detail.workspacePath===workspacePath);
 if(conflicts.some(x=>x.detail.projectId!==projectId))throw Error('Workspace já vinculado a outro estudo. A mudança de origem exige operação de migração explícita.');
 if(conflicts.some(x=>Number(x.detail.revision)>revision))throw Error('Não é permitido associar uma versão anterior à última revisão rastreada.');
 return {
  moduleId:REVIEW_LINK,entityId:projectId,obraId:project.obra_id||null,
  source:serialized({kind:REVIEW_LINK,projectId,workspacePath,job,cbimProjectId:String(workspace.project_id||''),cbimProjectName:String(workspace.project_name||''),revision,workspaceUpdatedAt:String(workspace.updated_at||''),linkedAt:new Date().toISOString()})
 };
}
export function prepareMeasurementLink(project,batch,operation,existing=[],actor=''){
 const projectId=required(project?.id,'Estudo BIM'),obraId=required(project?.obra_id,'Obra do estudo');
 const responsible=required(actor,'Responsável pela conferência');
 const batchId=required(batch?.batch_id,'Medição BIM'),operationalId=required(operation?.id,'Medição operacional');
 if(batch?.status!=='approved'||operation?.status!=='aprovada')throw Error('A conciliação exige medição BIM e operacional aprovada.');
 if(operation.obra_id!==obraId)throw Error('A medição operacional pertence a outra obra.');
 if(batch.period!==operation.periodo)throw Error('A competência BIM deve coincidir com a competência operacional.');
 if(!Array.isArray(batch.lines)||!batch.lines.length)throw Error('Medição BIM sem linhas IFC rastreáveis.');
 const units=[...new Set(batch.lines.map(x=>required(x.unit,'Unidade BIM')))];
 if(units.length!==1||!sameUnit(units[0],operation.unidade))throw Error('A unidade das medições precisa ser a mesma; não há conversão automática.');
 for(const line of batch.lines)numeric(line.delta_quantity,'Quantidade IFC');
 numeric(operation.quantidade,'Quantidade operacional');
 if(currentLinks(existing,MEASUREMENT_LINK).some(x=>x.detail.batchId===batchId||x.detail.operationalId===operationalId))throw Error('Medição já conciliada: associação duplicada proibida para evitar dupla contagem.');
 return {moduleId:MEASUREMENT_LINK,entityId:batchId,obraId,
  source:serialized({kind:MEASUREMENT_LINK,projectId,batchId,operationalId,period:batch.period,unit:units[0],guids:[...new Set(batch.lines.map(x=>required(x.global_id,'GUID IFC')))],batchApprovedAt:String(batch.approved_at||''),responsible,recordedAt:new Date().toISOString()})};
}
export function summarizeMeasurementReconciliation(project,batches=[],operations=[],links=[]){
 const indexes=currentLinks(links,MEASUREMENT_LINK);
 return batches.filter(b=>b.status==='approved').map(batch=>{
  const entry=indexes.find(x=>x.detail.projectId===project?.id&&x.detail.batchId===batch.batch_id);
  const op=entry&&operations.find(m=>m.id===entry.detail.operationalId&&m.obra_id===project?.obra_id);
  const units=[...new Set((batch.lines||[]).map(l=>l.unit))],unit=units.length===1?units[0]:null;
  const bimQuantity=(batch.lines||[]).reduce((n,l)=>n+numeric(l.delta_quantity,'Quantidade IFC'),0);
  const valid=!!op&&op.status==='aprovada'&&op.periodo===batch.period&&sameUnit(op.unidade,unit);
  const operationalQuantity=valid?numeric(op.quantidade,'Quantidade operacional'):null;
  const delta=valid?Math.round((bimQuantity-operationalQuantity)*1e9)/1e9:null;
  return {batchId:batch.batch_id,period:batch.period,unit,guids:(batch.lines||[]).map(x=>x.global_id),
    bimQuantity,operationalId:op?.id||null,operationalQuantity,delta,
    operationalValue:valid?operationalQuantity*numeric(op.preco_unitario,'Preço operacional'):null,
    responsible:entry?.detail.responsible||null,
    state:!entry?'nao_vinculada':!valid?'referencia_invalida':Math.abs(delta)<=1e-7?'conciliada':'divergente'};
 });
}
export function prepareMaterialLink(obraId,purchase,material,existing=[],actor=''){
 const workId=required(obraId,'Obra'),responsible=required(actor,'Responsável');
 const purchaseId=required(purchase?.id,'Compra'),materialId=required(material?.id,'Material');
 if(purchase.obra_id!==workId||material.obra_id!==workId)throw Error('Compra e material precisam pertencer à mesma obra.');
 if(!sameUnit(purchase.unidade,material.unidade))throw Error('Unidade de compra e material incompatível; não foi associada.');
 if(currentLinks(existing,MATERIAL_LINK).some(x=>x.detail.purchaseId===purchaseId))throw Error('Compra já vinculada a um material.');
 return {moduleId:MATERIAL_LINK,entityId:purchaseId,obraId:workId,source:serialized({
  kind:MATERIAL_LINK,purchaseId,materialId,unit:purchase.unidade,responsible,recordedAt:new Date().toISOString(),
  note:'Vínculo de rastreabilidade: não altera estoque, custo, pagamento ou lançamento financeiro.'
 })};
}
export function summarizePurchaseMaterialTrace(purchases=[],materials=[],links=[]){
 const linksByPurchase=currentLinks(links,MATERIAL_LINK);
 return purchases.map(p=>{
  const entry=linksByPurchase.find(x=>x.detail.purchaseId===p.id);
  const m=entry&&materials.find(m=>m.id===entry.detail.materialId&&m.obra_id===p.obra_id);
  const valid=!!m&&sameUnit(m.unidade,p.unidade);
  const qty=nonnegative(p.quantidade,'Quantidade de compra');
  const received=nonnegative(p.recebido,'Quantidade recebida');
  return {purchaseId:p.id,materialId:valid?m.id:null,materialName:valid?m.material:null,
   expectedQuantity:qty,receivedQuantity:received,pendingReceipt:Math.max(0,qty-received),
   registeredConsumption:valid?nonnegative(m.quantidade_realizada,'Consumo registrado'):null,
   paymentStatus:p.pagamento_status,unit:p.unidade,
   state:!entry?'nao_vinculada':!valid?'referencia_invalida':'rastreada'};
 });
}

// Purchase/ledger link does not post, modify or settle either side. One-to-one
// is deliberately conservative until the product supports partial payments.
export function preparePurchaseFinanceLink(obraId,purchase,entry,existing=[],actor=''){
 const workId=required(obraId,'Obra'), responsible=required(actor,'Responsável');
 const purchaseId=required(purchase?.id,'Pedido de compra'),entryId=required(entry?.id,'Lançamento financeiro');
 if(purchase.obra_id!==workId||entry.obra_id!==workId)throw Error('Pedido e lançamento precisam pertencer à mesma obra.');
 if(entry.tipo!=='despesa')throw Error('A conciliação exige um lançamento do tipo despesa.');
 nonnegative(purchase.valor_total,'Valor da compra');
 nonnegative(entry.valor,'Valor do lançamento');
 const used=currentLinks(existing,FINANCE_LINK);
 if(used.some(x=>x.detail.purchaseId===purchaseId||x.detail.entryId===entryId))throw Error('Compra ou despesa já vinculada; não é permitido associar o mesmo valor duas vezes.');
 return {moduleId:FINANCE_LINK,entityId:purchaseId,obraId:workId,
 source:serialized({kind:FINANCE_LINK,purchaseId,entryId,responsible,recordedAt:new Date().toISOString(),
  note:'Referência conferida. Não registra despesa, não muda pagamento nem duplica valores.'})};
}
export function summarizePurchaseFinanceTrace(purchases=[],entries=[],links=[]){
 const indexed=currentLinks(links,FINANCE_LINK);
 return purchases.map(p=>{
  const trace=indexed.find(x=>x.detail.purchaseId===p.id);
  const entry=trace&&entries.find(e=>e.id===trace.detail.entryId&&e.obra_id===p.obra_id&&e.tipo==='despesa');
  const amount=nonnegative(p.valor_total,'Valor da compra');
  const posted=entry?nonnegative(entry.valor,'Valor da despesa'):null;
  const delta=posted===null?null:Math.round((amount-posted)*100)/100;
  const paymentStatus=String(p.pagamento_status||'pendente');
  const ledgerStatus=entry?.status||null;
  const paymentCompatible=entry?((paymentStatus==='pago')===(ledgerStatus==='pago')):false;
  return {purchaseId:p.id,entryId:entry?.id||null,purchaseAmount:amount,recordedExpenseAmount:posted,delta,
   paymentStatus,ledgerStatus,responsible:trace?.detail.responsible||null,
   state:!trace?'nao_vinculada':!entry?'referencia_invalida':Math.abs(delta)<=0.01&&paymentCompatible?'conferida':'divergente'};
 });
}

export function assertStudyWorkAssociation(project,obraId){
 const id=required(project?.id,'Estudo BIM');
 const target=required(obraId,'Obra');
 if(project.obra_id&&project.obra_id!==target)throw Error('O estudo já está associado a outra obra. A transferência exige um processo de migração explícito.');
 return project.obra_id!==target;
}
