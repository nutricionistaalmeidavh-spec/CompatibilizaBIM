import React from 'react';
type Props={project:any};
const bridge=()=> (globalThis as any).engineeringStorage?.bim?.p2;
const money=(v:any)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
export function Bim4D5DPanel({project}:Props){
 const [tab,setTab]=React.useState('qto'),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const [overview,setOverview]=React.useState<any>(null),[quant,setQuant]=React.useState<any>(null),[budget,setBudget]=React.useState<any>(null),[simulation,setSimulation]=React.useState<any>(null),[financial,setFinancial]=React.useState<any>(null);
 const [date,setDate]=React.useState('2026-10-12'),[activity,setActivity]=React.useState(''),[guid,setGuid]=React.useState(''),[quantity,setQuantity]=React.useState(''),[percent,setPercent]=React.useState('0'),[period,setPeriod]=React.useState('2026-10'),[approver,setApprover]=React.useState('');
 const api=async(action:string,params:any={})=>{
   const native=bridge();if(!native)throw Error('Operação 4D/5D exige o runtime desktop empacotado.');
   return await native({projectId:project.id,action,params});
 };
 const reload=async()=>{
   if(!bridge())return;
   const status=await api('status');setOverview(status);
   if(status.quantities)setQuant(await api('quantity_records'));
   if(status.budget)setBudget(await api('budget_report'));
 };
 React.useEffect(()=>{setQuant(null);setBudget(null);setOverview(null);setNotice('');setError('');void reload().catch((e:any)=>setError(e.message));},[project.id]);
 const run=async(action:string,params:any={},success='Dados atualizados e preservados localmente.')=>{
   setBusy(true);setError('');setNotice('');
   try{const result=await api(action,params);await reload();setNotice(success);return result;}
   catch(e:any){setError(e.message||String(e));return null;}finally{setBusy(false);}
 };
 const models=(project.modelos||[]).filter((m:any)=>String(m.arquivo_nome||'').toLowerCase().endsWith('.ifc')&&m.arquivo_base64);
 const records=quant?.records||[],activities=overview?.activities||[],batches=overview?.measurements||[];
 const guidRecords=records.filter((r:any)=>r.global_id===guid&&r.source!=='geometry_fallback');
 const selected=guidRecords.find((r:any)=>r.kind+'|'+r.quantity_name===quantity);
 return <section className="cbim-react-panel p2-workbench">
  <h2>Quantitativos 5D, cronograma 4D e medições</h2>
  <p>Motor Python único, offline. Quantidades são rastreáveis a GUID/IFC; preços vêm do catálogo local. Progresso não equivale a medição ou pagamento.</p>
  <div className="cbim-react-toolbar" role="group" aria-label="Etapas BIM 4D 5D">
   <button aria-pressed={tab==='qto'} onClick={()=>setTab('qto')}>Quantidades e 5D</button>
   <button aria-pressed={tab==='4d'} onClick={()=>setTab('4d')}>Cronograma 4D</button>
   <button aria-pressed={tab==='med'} onClick={()=>setTab('med')}>Medições</button>
  </div>
  {!bridge()&&<p role="status">Modo web de inspeção: processamento 4D/5D requer aplicativo desktop. Nenhum preço ou quantidade foi simulado.</p>}
  {tab==='qto'&&<>
   <h3>1. Extrair quantitativos de IFC real</h3>
   <p>{models.length} IFC(s) disponíveis · {overview?.quantities?.record_count||0} registro(s) persistidos.</p>
   <button disabled={busy||!models.length||!bridge()} onClick={()=>void run('quantities',{models:models.map((m:any)=>({id:m.id,name:m.arquivo_nome,discipline:m.disciplina,base64:m.arquivo_base64})),allowGeometryFallback:false},'Quantitativos IFC/QTO verificados, sem fallback geométrico.')}>Extrair QTO do IFC</button>
   <p className="studio-muted">A ausência de QTO real não gera valores fictícios. Detalhes permanecem no arquivo quantities.json do estudo.</p>
   {records.length>0&&<div className="p2-scroll"><table><thead><tr><th>GUID</th><th>Classe</th><th>Pavimento</th><th>Quantidade</th><th>Fonte</th></tr></thead><tbody>{records.slice(0,120).map((r:any,i:number)=><tr key={i}><td><code>{r.global_id}</code></td><td>{r.ifc_class}</td><td>{r.storey||'—'}</td><td>{Number(r.value).toLocaleString('pt-BR')} {r.unit}</td><td>{r.source}</td></tr>)}</tbody></table></div>}
   {quant?.truncated&&<p>Prévia limitada; o relatório completo permanece armazenado no disco.</p>}
   <h3>2. Tabela de composições e custos locais</h3>
   <label>Catálogo JSON com fonte, competência, BDI, composições e mapeamentos IFC
    <input type="file" accept=".json" disabled={busy||!bridge()} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void f.text().then(s=>run('pricebook',{book:JSON.parse(s)},'Tabela de preços validada com origem e competência.')).catch(err=>setError(err.message));}}/>
   </label>
   <p>{overview?.pricebook?'Fonte: '+overview.pricebook.source+' · '+overview.pricebook.reference_date:'Nenhuma tabela de preços fornecida. Nenhum valor será presumido.'}</p>
   <h3>3. Orçamento 5D</h3>
   <button disabled={busy||!overview?.quantities||!overview?.pricebook} onClick={()=>void run('budget',{},'Orçamento 5D calculado; examine grupos não precificados.')}>Calcular orçamento</button>
   {budget&&<><div className="p2-kpis"><strong>{money(budget.total_cost)}<small>Subtotal precificado</small></strong><strong>{budget.matched_group_count}<small>Grupos precificados</small></strong><strong>{budget.unmatched_group_count}<small>Sem composição</small></strong></div><p>Base: {budget.source} · {budget.reference_date} · BDI {budget.bdi_percent}%</p>
    {budget.unmatched_group_count>0&&<p role="status">Orçamento parcial. Grupos não precificados não compõem o subtotal.</p>}
    <div className="p2-scroll"><table><thead><tr><th>Código</th><th>Serviço</th><th>Quantidade</th><th>Unidade</th><th>Unitário</th><th>Total</th></tr></thead><tbody>{(budget.lines||[]).slice(0,120).map((r:any)=><tr key={r.line_id}><td>{r.composition_code}</td><td>{r.description}</td><td>{r.quantity}</td><td>{r.unit}</td><td>{money(r.final_unit_cost)}</td><td>{money(r.total_cost)}</td></tr>)}</tbody></table></div>
   </>}
  </>}
  {tab==='4d'&&<>
   <h3>Cronograma de atividades</h3>
   <label>Importar CSV (activity_id, name, start_date, end_date, predecessors)
    <input type="file" accept=".csv" disabled={busy||!bridge()} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void f.text().then(csv=>run('import_schedule',{csv},'Cronograma importado.')).catch(err=>setError(err.message));}}/>
   </label>
   <form className="cbim-react-form-grid" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run('activity',{activity_id:f.get('id'),name:f.get('name'),start_date:f.get('start'),end_date:f.get('end'),composition_code:f.get('composition')},'Atividade criada.');}}>
    <label>Código<input name="id" required/></label><label>Atividade<input name="name" required/></label><label>Início<input type="date" name="start" required/></label><label>Fim<input type="date" name="end" required/></label><label>Composição (opcional)<input name="composition"/></label><button disabled={busy||!bridge()}>Adicionar</button>
   </form>
   <div className="p2-scroll"><table><thead><tr><th>Atividade</th><th>Início</th><th>Fim</th><th>Real</th><th>GUIDs</th></tr></thead><tbody>{activities.map((a:any)=><tr key={a.activity_id}><td>{a.activity_id} · {a.name}</td><td>{a.start_date}</td><td>{a.end_date}</td><td>{a.actual_progress}%</td><td>{(a.linked_guids||[]).length}</td></tr>)}</tbody></table></div>
   <h3>Vincular GUID e registrar progresso</h3>
   <div className="cbim-react-form-grid">
    <label>Atividade<select value={activity} onChange={e=>setActivity(e.target.value)}><option value="">Selecione</option>{activities.map((a:any)=><option key={a.activity_id} value={a.activity_id}>{a.name}</option>)}</select></label>
    <label>GUID IFC<select value={guid} onChange={e=>{setGuid(e.target.value);setQuantity('');}}><option value="">Selecione</option>{Array.from(new Map(records.map((r:any)=>[r.global_id,r])).values()).slice(0,300).map((r:any)=><option value={r.global_id} key={r.global_id}>{r.global_id}</option>)}</select></label>
    <button disabled={busy||!activity||!guid} onClick={()=>void run('link',{activity_id:activity,guids:[guid]},'GUID associado à atividade.')}>Vincular</button>
    <label>Data de referência<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Progresso real acumulado (%)<input type="number" min="0" max="100" value={percent} onChange={e=>setPercent(e.target.value)}/></label>
    <button disabled={busy||!activity} onClick={()=>void run('progress',{activity_id:activity,progress:Number(percent),recorded_on:date},'Progresso registrado com data.')}>Registrar avanço</button>
    <button disabled={busy||!activities.length} onClick={async()=>{setBusy(true);try{setSimulation(await api('simulate',{date}));}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>Simular 4D na data</button>
   </div>
   {simulation&&<><div className="p2-kpis"><strong>{simulation.overall.planned_progress}%<small>Previsto</small></strong><strong>{simulation.overall.actual_progress}%<small>Real</small></strong><strong>{simulation.overall.variance_percent}%<small>Desvio</small></strong></div>
    {simulation.activities.map((a:any)=><p key={a.activity_id}>{a.name} · {a.status} · {a.planned_progress}% previsto / {a.actual_progress}% real</p>)}</>}
  </>}
  {tab==='med'&&<>
   <h3>Medição física cumulativa por GUID</h3>
   <div className="cbim-react-form-grid">
    <label>GUID IFC<select value={guid} onChange={e=>{setGuid(e.target.value);setQuantity('');}}><option value="">Selecione</option>{Array.from(new Map(records.map((r:any)=>[r.global_id,r])).values()).slice(0,300).map((r:any)=><option key={r.global_id} value={r.global_id}>{r.global_id}</option>)}</select></label>
    <label>Grandeza<select value={quantity} onChange={e=>setQuantity(e.target.value)}><option value="">Selecione</option>{guidRecords.map((r:any,i:number)=><option key={i} value={r.kind+'|'+r.quantity_name}>{r.quantity_name} · {r.unit}</option>)}</select></label>
    <label>Competência<input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
    <label>Avanço físico acumulado (%)<input type="number" min="0" max="100" value={percent} onChange={e=>setPercent(e.target.value)}/></label>
    <label>Atividade<select value={activity} onChange={e=>setActivity(e.target.value)}><option value="">Sem atividade</option>{activities.map((a:any)=><option key={a.activity_id} value={a.activity_id}>{a.name}</option>)}</select></label>
    <button disabled={busy||!selected} onClick={()=>void run('measure',{guids:[guid],kind:selected?.kind,quantity_name:selected?.quantity_name,period,percent:Number(percent),activity_id:activity||null},'Rascunho incremental salvo; só aprovações anteriores entram no desconto.')}>Criar medição</button>
   </div>
   <label>Responsável pela aprovação<input value={approver} onChange={e=>setApprover(e.target.value)} placeholder="Nome do responsável técnico"/></label>
   {batches.map((b:any)=><article key={b.batch_id} className="p2-measure">
    <strong>{b.batch_id} · {b.period} · {b.status}</strong>
    {(b.lines||[]).map((l:any,i:number)=><small key={i}>{l.global_id}: +{l.delta_quantity} {l.unit} ({l.previous_percent}% → {l.cumulative_percent}%)</small>)}
    {b.status==='draft'&&<div className="cbim-react-toolbar"><button disabled={busy||!approver.trim()} onClick={()=>void run('approve',{batch_id:b.batch_id,approved_by:approver},'Medição aprovada com autor e data.')}>Aprovar</button><button disabled={busy} onClick={()=>{const reason=window.prompt('Justificativa para rejeição');if(reason?.trim())void run('reject',{batch_id:b.batch_id,reason},'Medição rejeitada.');}}>Rejeitar</button></div>}
   </article>)}
   <h3>Conciliação orçamento × medido aprovado</h3>
   <button disabled={busy||!overview?.budget} onClick={async()=>{setBusy(true);setError('');try{setFinancial(await api('finance'));}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>Calcular confronto 5D/4D</button>
   {financial&&<><div className="p2-kpis"><strong>{money(financial.budget_total)}<small>Orçado</small></strong><strong>{money(financial.total_measured)}<small>Medido aprovado</small></strong><strong>{money(financial.remaining_budget)}<small>Saldo orçamentário</small></strong></div>
    {!!financial.unmatched_line_count&&<p>{financial.unmatched_line_count} linha(s) sem composição inequívoca; não receberam preço.</p>}
    <p className="studio-muted">Valores pagos ou recebidos não são lançados por este módulo e não podem ser inferidos das medições.</p></>}
  </>}
  {error&&<p role="alert" className="cbim-react-error">{error} Nenhum valor foi preenchido automaticamente.</p>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
