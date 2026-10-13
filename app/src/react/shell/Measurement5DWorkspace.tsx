import React from 'react';

type Props={
 projectId:string; batches:any[];activities:any[];quantities:any;budgetAvailable:boolean;
 busy:boolean;desktop:boolean;initialGuid?:string;initialQuantity?:string;
 onAction:(action:string,params:any,success:string)=>Promise<any>;
 onQuery:(action:string,params:any)=>Promise<any>;
};
const n=(x:any)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(Number(x)||0);
const money=(x:any)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(x)||0);
const dateStamp=(s:any)=>s?new Date(String(s)).toLocaleString('pt-BR'):'—';
const statusLabel=(s:any)=>s==='approved'?'Aprovada':s==='rejected'?'Rejeitada':'Rascunho';
const periodNow=()=>{const today=new Date();return today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');};
const clean=(x:any)=>String(x||'').toLocaleLowerCase('pt-BR');
export function Measurement5DWorkspace({projectId,batches,activities,quantities,budgetAvailable,busy,desktop,initialGuid='',initialQuantity='',onAction,onQuery}:Props){
 const [query,setQuery]=React.useState('');
 const [results,setResults]=React.useState<any[]>([]);
 const [count,setCount]=React.useState(0);
 const [offset,setOffset]=React.useState(0);
 const [looking,setLooking]=React.useState(false);
 const [selection,setSelection]=React.useState(initialGuid);
 const [lines,setLines]=React.useState<any[]>([]);
 const [loadingLines,setLoadingLines]=React.useState(false);
 const [lineKey,setLineKey]=React.useState(initialQuantity);
 const [period,setPeriod]=React.useState(periodNow);
 const [progress,setProgress]=React.useState('0');
 const [activity,setActivity]=React.useState('');
 const [contractor,setContractor]=React.useState('');
 const [approver,setApprover]=React.useState('');
 const [rejection,setRejection]=React.useState('');
 const [decision,setDecision]=React.useState<{action:'approve'|'reject';batchId:string}|null>(null);
 const [filter,setFilter]=React.useState('todos');
 const [findBatch,setFindBatch]=React.useState('');
 const [page,setPage]=React.useState(0);
 const [error,setError]=React.useState('');
 const [notice,setNotice]=React.useState('');
 const [financial,setFinancial]=React.useState<any|null>(null);
 const [calculating,setCalculating]=React.useState(false);
 React.useEffect(()=>{setSelection('');setResults([]);setLines([]);setLineKey('');setFinancial(null);setError('');setDecision(null);setPage(0);},[projectId]);
 React.useEffect(()=>{if(initialGuid)setSelection(initialGuid);if(initialQuantity)setLineKey(initialQuantity);},[initialGuid,initialQuantity]);
 const loadLines=React.useCallback(async(guid:string)=>{
   setLines([]);setError('');setLoadingLines(true);
   try{
     if(!guid||!desktop)return;
     const q=await onQuery('quantity_records',{globalId:guid});
     setLines((q.records||[]).filter((row:any)=>row.global_id===guid&&row.source!=='geometry_fallback'));
   }catch(e:any){setError(e.message||String(e));}
   finally{setLoadingLines(false);}
 },[desktop,onQuery]);
 React.useEffect(()=>{if(selection&&desktop)void loadLines(selection);},[selection,desktop,projectId]);
 const search=async(start=0)=>{
   if(!desktop||query.trim().length<2)return;
   setLooking(true);setError('');setNotice('');
   try{
     const data=await onQuery('guid_lookup',{search:query.trim(),limit:40,offset:start});
     setResults(data.entries||[]);setCount(Number(data.total)||0);setOffset(start);
     if(!data.total)setNotice('Nenhum elemento com quantitativos IFC verificáveis encontrado.');
   }catch(e:any){setError(e.message||String(e));setResults([]);setCount(0);}
   finally{setLooking(false);}
 };
 const totals=React.useMemo(()=>{
   const units:Record<string,number>={};
   for(const b of batches)if(b.status==='approved')for(const l of b.lines||[]){
     const unit=String(l.unit||'sem unidade');
     units[unit]=(units[unit]||0)+Number(l.delta_quantity||0);
   }
   return units;
 },[batches]);
 const draftCount=batches.filter((b:any)=>b.status==='draft').length;
 const approvedCount=batches.filter((b:any)=>b.status==='approved').length;
 const approvedUnits=Object.entries(totals);
 const selectedLine=lines.find((r:any)=>r.kind+'|'+r.quantity_name===lineKey);
 const approvedHistory=batches.filter((b:any)=>b.status==='approved').flatMap((b:any)=>(b.lines||[]).filter((l:any)=>l.global_id===selection&&l.kind+'|'+l.quantity_name===lineKey&&l.unit===selectedLine?.unit).map((l:any)=>({batch:b.batch_id,period:b.period,percent:Number(l.cumulative_percent),quantity:Number(l.delta_quantity)})));
 const baseline=approvedHistory.reduce((p:number,r:any)=>Math.max(p,r.percent),0);
 const filtered=batches.filter((b:any)=>(filter==='todos'||filter===b.status)&&(!findBatch.trim()||[b.batch_id,b.period,b.approved_by,b.contractor,b.activity_id,...(b.lines||[]).map((x:any)=>x.global_id)].some(v=>clean(v).includes(clean(findBatch.trim())))));
 const visible=filtered.slice(page*8,(page+1)*8);
 const create=async()=>{
   setError('');setNotice('');
   if(!selection||!selectedLine){setError('Selecione um elemento e uma grandeza IFC com QTO verificável.');return;}
   const pct=Number(progress);
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)){setError('Informe uma competência no formato AAAA-MM.');return;}
   if(!Number.isFinite(pct)||pct<baseline||pct>100){setError('O avanço acumulado deve estar entre '+n(baseline)+'% (já aprovado) e 100%.');return;}
   const response=await onAction('measure',{guids:[selection],kind:selectedLine.kind,quantity_name:selectedLine.quantity_name,
     percent:pct,period,activity_id:activity||null,contractor:contractor.trim()||null},
      'Rascunho criado pelo motor. Nenhum valor foi aprovado ou pago.');
   if(response){setNotice('Rascunho criado. Confira as quantidades incrementais antes de aprovar.');setFinancial(null);}
 };
 const decide=async()=>{
   if(!decision)return;
   if(decision.action==='approve'&&!approver.trim()){setError('Identifique o responsável pela aprovação.');return;}
   if(decision.action==='reject'&&!rejection.trim()){setError('Informe uma justificativa para rejeição.');return;}
   const action=decision.action;
   setError('');
   const result=await onAction(action,action==='approve'?{batch_id:decision.batchId,approved_by:approver.trim()}:{batch_id:decision.batchId,reason:rejection.trim()},
     action==='approve'?'Aprovação registrada pelo motor, com responsável e data.':'Rejeição registrada com justificativa.');
   if(result){setNotice('Decisão salva no motor local.');setDecision(null);setRejection('');setFinancial(null);}
 };
 const calculate=async()=>{
   setCalculating(true);setError('');
   try{setFinancial(await onQuery('finance',{}));}catch(e:any){setError(e.message||String(e));}
   finally{setCalculating(false);}
 };
 return <section className="cbim-5d-workspace" data-testid="cbim-5d-workspace" aria-label="Medições BIM e análise 5D">
   <header className="cbim-5d-hero"><div><span>MEDIÇÕES / BIM 5D</span><h3>Medições e conferência técnica</h3>
     <p>Quantitativos IFC rastreados por GUID. Rascunho, aprovação e orçamento seguem contratos distintos.</p></div>
     <strong>{batches.length}<small>lotes registrados</small></strong></header>
   <div className="cbim-5d-kpis" aria-label="Situação real das medições">
     <article><span>Lotes em análise</span><strong>{draftCount}</strong><small>Ainda não aprovados</small></article>
     <article><span>Lotes aprovados</span><strong>{approvedCount}</strong><small>Decisões explícitas do motor</small></article>
     <article><span>Lotes rejeitados</span><strong>{batches.filter((b:any)=>b.status==='rejected').length}</strong><small>Não entram no acumulado</small></article>
     <article><span>Grandezas aprovadas</span><strong>{approvedUnits.length}</strong><small>Unidades exibidas separadamente</small></article>
   </div>
   <section className="cbim-5d-surface cbim-5d-builder" aria-label="Criar medição por QTO IFC">
     <div className="cbim-5d-section-head"><div><h4>Nova medição BIM</h4><small>Etapa 1 · localizar elemento com quantidade extraída do IFC original</small></div></div>
     <div className="cbim-5d-search">
       <label>Buscar por GUID, elemento ou arquivo IFC<input type="search" aria-label="Buscar GUID para medição" placeholder="Ex.: GUID ou IfcPipeSegment" value={query} onChange={e=>{setQuery(e.target.value);setResults([]);setCount(0);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void search(0);}}}/></label>
       <button type="button" disabled={!desktop||looking||query.trim().length<2} onClick={()=>void search(0)}>{looking?'Consultando…':'Buscar no QTO'}</button>
     </div>
     {results.length>0&&<><div className="cbim-5d-results" role="group" aria-label="Resultados de quantitativos IFC">
       {results.map((r:any)=><button type="button" aria-pressed={selection===r.global_id} key={r.global_id+'|'+r.source_file} onClick={()=>{setSelection(r.global_id);setLineKey('');}}>
         <b>{r.global_id}</b><small>{r.element_name||r.ifc_class} · {r.source_file} · {r.storey||'Sem pavimento'}</small>
       </button>)}</div><div className="cbim-5d-pagination"><span>{offset+1}–{offset+results.length} de {count} elemento(s)</span>
         <button type="button" disabled={looking||offset===0} onClick={()=>void search(Math.max(0,offset-40))}>Anterior</button>
         <button type="button" disabled={looking||offset+40>=count} onClick={()=>void search(offset+40)}>Próxima</button></div></>}
     {selection&&<div className="cbim-5d-selected"><strong>Elemento IFC selecionado</strong><code>{selection}</code>{loadingLines&&<small>Carregando quantitativos…</small>}</div>}
     <div className="cbim-5d-editor">
       <label>Grandeza verificável<select aria-label="Grandeza QTO IFC" value={lineKey} onChange={e=>setLineKey(e.target.value)} disabled={!desktop||!selection||loadingLines}>
         <option value="">Selecione a grandeza</option>{lines.map((r:any,i:number)=><option key={i} value={r.kind+'|'+r.quantity_name}>{r.quantity_name} · {n(r.value)} {r.unit}</option>)}</select></label>
       <label>Competência<input aria-label="Competência BIM" type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
       <label>Avanço físico acumulado (%)<input aria-label="Avanço físico acumulado" type="number" min="0" max="100" step=".1" value={progress} onChange={e=>setProgress(e.target.value)}/></label>
       <label>Atividade 4D (opcional)<select aria-label="Atividade da medição" value={activity} onChange={e=>setActivity(e.target.value)}>
         <option value="">Sem atividade vinculada</option>{activities.map((a:any)=><option key={a.activity_id} value={a.activity_id}>{a.activity_id} · {a.name}</option>)}</select></label>
       <label>Executor (opcional)<input value={contractor} onChange={e=>setContractor(e.target.value)} placeholder="Equipe/contratado"/></label>
     </div>
     {selectedLine&&<div className="cbim-5d-calc-preview">
       <div><span>QTO IFC de origem</span><strong>{n(selectedLine.value)} {selectedLine.unit}</strong><small>{selectedLine.source_file} · {selectedLine.quantity_name}</small></div>
       <div><span>Último avanço aprovado</span><strong>{n(baseline)}%</strong><small>Apurado dos lotes aprovados</small></div>
       <div><span>Incremento indicativo</span><strong>{n(Math.max(0,Number(selectedLine.value||0)*(Number(progress||0)-baseline)/100))} {selectedLine.unit}</strong><small>Prévia; o motor recalcula ao salvar/aprovar</small></div>
     </div>}
     <div className="cbim-5d-footer"><p>Rascunhos não integram totais aprovados. Quantitativos sintéticos ou fallback geométrico não são aceitos.</p>
       <button type="button" disabled={!desktop||busy||!selectedLine} onClick={()=>void create()}>Criar rascunho de medição</button></div>
   </section>
   <section className="cbim-5d-surface" aria-label="Lotes de medições BIM">
     <div className="cbim-5d-section-head"><div><h4>Histórico de lotes BIM</h4><small>Origem canônica no arquivo de medições do estudo</small></div></div>
     <div className="cbim-5d-batch-filters"><label>Filtrar lote<select aria-label="Estado dos lotes BIM" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}>
       <option value="todos">Todos</option><option value="draft">Rascunhos</option><option value="approved">Aprovados</option><option value="rejected">Rejeitados</option></select></label>
       <label>Pesquisar lote<input aria-label="Pesquisar lotes BIM" type="search" value={findBatch} onChange={e=>{setFindBatch(e.target.value);setPage(0);}} placeholder="Código, competência, responsável, GUID…"/></label></div>
     {visible.map((b:any)=><article className="cbim-5d-batch" key={b.batch_id}>
       <div className="cbim-5d-batch-heading"><div><strong>{b.batch_id}</strong><small>Competência {b.period} · {b.activity_id?'Atividade '+b.activity_id+' · ':''}{b.contractor||'Executor não informado'}</small></div>
         <span className={'cbim-5d-status '+b.status}>{statusLabel(b.status)}</span></div>
       <div className="cbim-5d-batch-lines">{(b.lines||[]).map((l:any,index:number)=><div key={l.global_id+'-'+index}>
         <div><b>{l.element_name||l.ifc_class}</b><small>{l.global_id} · {l.quantity_name}</small></div>
         <div><small>Avanço anterior → atual</small><strong>{n(l.previous_percent)}% → {n(l.cumulative_percent)}%</strong></div>
         <div><small>Quantidade incremental</small><strong>+{n(l.delta_quantity)} {l.unit}</strong></div></div>)}</div>
       {b.status==='approved'&&<p className="cbim-5d-decision-evidence">Aprovada por {b.approved_by||'responsável registrado'} · {dateStamp(b.approved_at)}</p>}
       {b.status==='rejected'&&<p className="cbim-5d-decision-evidence">Rejeitada: {b.rejected_reason||'Motivo não informado na origem'}</p>}
       {b.status==='draft'&&<div className="cbim-5d-batch-actions">
         <button type="button" disabled={!desktop||busy} onClick={()=>{setDecision({action:'approve',batchId:b.batch_id});setRejection('');}}>Conferir e aprovar</button>
         <button type="button" disabled={!desktop||busy} onClick={()=>{setDecision({action:'reject',batchId:b.batch_id});setRejection('');}}>Rejeitar com justificativa</button></div>}
     </article>)}
     {!visible.length&&<p className="cbim-5d-empty">{batches.length?'Nenhuma medição corresponde aos filtros.':'Não há medições registradas. Os indicadores permanecem zerados até existir um lote real.'}</p>}
     <div className="cbim-5d-pagination"><span>Exibindo {visible.length?page*8+1:0}–{Math.min((page+1)*8,filtered.length)} de {filtered.length} lotes</span>
       <button type="button" disabled={page===0} onClick={()=>setPage(v=>Math.max(0,v-1))}>Anterior</button>
       <button type="button" disabled={(page+1)*8>=filtered.length} onClick={()=>setPage(v=>v+1)}>Próxima</button></div>
   </section>
   {decision&&<section className="cbim-5d-decision-panel" role="group" aria-label="Confirmar decisão de medição">
     <h4>{decision.action==='approve'?'Aprovar lote BIM':'Rejeitar lote BIM'} · {decision.batchId}</h4>
     <p>{decision.action==='approve'?'A aprovação é uma decisão técnica. O motor recalculará o incremental contra o último aprovado.':'Uma rejeição deve incluir justificativa; o lote não será contabilizado como aprovado.'}</p>
     {decision.action==='approve'?<label>Responsável técnico<input aria-label="Responsável pela aprovação BIM" value={approver} onChange={e=>setApprover(e.target.value)}/></label>:
       <label>Motivo da rejeição<textarea aria-label="Motivo da rejeição BIM" rows={3} value={rejection} onChange={e=>setRejection(e.target.value)}/></label>}
     <div><button type="button" disabled={!desktop||busy} onClick={()=>void decide()}>Confirmar decisão</button>
       <button type="button" onClick={()=>setDecision(null)}>Cancelar</button></div>
   </section>}
   <section className="cbim-5d-surface" aria-label="Orçamento contra medições aprovadas">
     <div className="cbim-5d-section-head"><div><h4>Confronto com orçamento 5D</h4><small>Somente valores precificados por catálogo com fonte</small></div>
       <button type="button" disabled={!desktop||busy||calculating||!budgetAvailable} onClick={()=>void calculate()}>{calculating?'Calculando…':'Confrontar orçamento × aprovado'}</button></div>
     {!budgetAvailable&&<p className="cbim-5d-empty">Nenhum orçamento 5D calculado para o estudo. Os valores financeiros não serão presumidos.</p>}
     {approvedUnits.length>0&&<div className="cbim-5d-unit-summary">{approvedUnits.map(([unit,total])=><div key={unit}><span>Quantidade BIM incremental aprovada</span><strong>{n(total)} {unit}</strong></div>)}</div>}
     {financial&&<><div className="cbim-5d-finance-kpis">
       <div><span>Orçado precificado</span><strong>{money(financial.budget_total)}</strong></div>
       <div><span>Medido aprovado precificado</span><strong>{money(financial.total_measured)}</strong></div>
       <div><span>Saldo orçamentário</span><strong>{money(financial.remaining_budget)}</strong></div>
     </div>{Number(financial.unmatched_line_count)>0&&<p className="cbim-5d-unmatched">{financial.unmatched_line_count} linha(s) não precificada(s), excluídas do total. Corrija as composições antes de interpretar o resultado.</p>}
       <p className="cbim-5d-empty">Não são lançados valores pagos ou receitas neste confronto; a medição aprovada não comprova pagamento.</p></>}
   </section>
   {notice&&<p role="status" className="cbim-5d-notice">{notice}</p>}
   {error&&<p role="alert" className="cbim-react-error">{error}</p>}
   {!desktop&&<p role="status" className="cbim-5d-empty">Modo web de inspeção: criação, aprovação, busca IFC completa e confronto de valores exigem o aplicativo desktop offline. Nenhuma quantidade foi simulada.</p>}
 </section>;
}
