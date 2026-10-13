import {Schedule4DWorkspace} from './Schedule4DWorkspace';
import {Measurement5DWorkspace} from './Measurement5DWorkspace';
import {EngineeringFeedback} from '../components/EngineeringUI';
import {SchedulePreview} from './SchedulePreview';
import {IfcQueryPanel} from './IfcQueryPanel';
import {QuantitiesGrid} from './QuantitiesGrid';
import {measurementSelection} from '../../../../src/bim/visualizationAdapters.js';
import React from 'react';
import {Metric} from '../components/ui';
import {budgetBreakdown,engineeringNumber} from '../../../../src/domain/engineeringPresentation.js';
import {brlReais} from '../../../../src/factory/format.js';
type Props={project:any};
const bridge=()=> (globalThis as any).engineeringStorage?.bim?.p2;
const money=brlReais;
export function Bim4D5DPanel({project}:Props){
 const [tab,setTab]=React.useState('qto'),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const [overview,setOverview]=React.useState<any>(null),[quant,setQuant]=React.useState<any>(null),[budget,setBudget]=React.useState<any>(null),[simulation,setSimulation]=React.useState<any>(null),[financial,setFinancial]=React.useState<any>(null);
 const [date,setDate]=React.useState(()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)),[activity,setActivity]=React.useState(''),[guid,setGuid]=React.useState(''),[quantity,setQuantity]=React.useState(''),[percent,setPercent]=React.useState('0'),[period,setPeriod]=React.useState(()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,7)),[approver,setApprover]=React.useState('');
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
 React.useEffect(()=>{
  setQuant(null);setBudget(null);setOverview(null);setSimulation(null);setFinancial(null);
  setActivity('');setGuid('');setQuantity('');setPercent('0');setApprover('');
  setNotice('');setError('');void reload().catch((e:any)=>setError(e.message));
 },[project.id]);
 const run=async(action:string,params:any={},success='Dados atualizados e preservados localmente.')=>{
   setBusy(true);setError('');setNotice('');
   try{const result=await api(action,params);await reload();setNotice(success);return result;}
   catch(e:any){setError(e.message||String(e));return null;}finally{setBusy(false);}
 };
 const downloadReport=async(action:string,format:string)=>{
  setBusy(true);setError('');
  try{
   const output=await api(action,{format});
   const raw=atob(String(output.base64||'')),buf=new Uint8Array(raw.length);
   for(let i=0;i<raw.length;i++)buf[i]=raw.charCodeAt(i);
   const url=URL.createObjectURL(new Blob([buf],{type:format==='pdf'?'application/pdf':format==='json'?'application/json':'text/csv'}));
   const a=document.createElement('a');a.href=url;a.download=output.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(e:any){setError(e.message||String(e));}finally{setBusy(false);}
 };
 const models=(project.modelos||[]).filter((m:any)=>String(m.arquivo_nome||'').toLowerCase().endsWith('.ifc')&&m.arquivo_base64);
 const records=quant?.records||[],activities=overview?.activities||[],batches=overview?.measurements||[];
 const guidRecords=records.filter((r:any)=>r.global_id===guid&&r.source!=='geometry_fallback');
 const selected=guidRecords.find((r:any)=>r.kind+'|'+r.quantity_name===quantity);
 const costDetails=budgetBreakdown(budget);
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
   {records.length>0&&<><div className="cbim-react-toolbar"><button disabled={busy} onClick={()=>void downloadReport('export_quantities','csv')}>Exportar QTO CSV</button><button disabled={busy} onClick={()=>void downloadReport('export_quantities','json')}>Exportar QTO JSON</button></div><QuantitiesGrid mode="qto" records={records} onPick={row=>{const picked=measurementSelection(row);if(!picked){setError('Seleção sem QTO IFC válido. Corrija a origem para usar em medição.');return;}setGuid(picked.guid);setQuantity(picked.quantity);setError('');setNotice('Grandeza IFC selecionada para medição. Abra a aba Medições para continuar.');}}/></>}
   {quant?.truncated&&<p role="status">Prévia limitada aos primeiros {records.length} de {quant.total} registros. Exporte QTO CSV/JSON para obter o conjunto completo sem perda de registros.</p>}
   {guid&&quantity&&<p role="status">Grandeza selecionada: {guid} · {quantity}. Continue na aba Medições, após confirmar a versão IFC.</p>}
   <IfcQueryPanel key={project.id} revisions={overview?.quantities?.revision_sha256||{}} onQuery={params=>api('ifc_query',params)}/>
   <h3>2. Tabela de composições e custos locais</h3>
   <label>Catálogo JSON com fonte, competência, BDI, composições e mapeamentos IFC
    <input type="file" accept=".json" disabled={busy||!bridge()} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void f.text().then(s=>run('pricebook',{book:JSON.parse(s)},'Tabela de preços validada com origem e competência.')).catch(err=>setError(err.message));}}/>
   </label>
   <p>{overview?.pricebook?'Fonte: '+overview.pricebook.source+' · '+overview.pricebook.reference_date:'Nenhuma tabela de preços fornecida. Nenhum valor será presumido.'}</p>
   <h3>3. Orçamento 5D</h3>
   <button disabled={busy||!overview?.quantities||!overview?.pricebook} onClick={()=>void run('budget',{},'Orçamento 5D calculado; examine grupos não precificados.')}>Calcular orçamento</button>
   {budget&&<><div className="cbim-react-toolbar"><button disabled={busy} onClick={()=>void downloadReport('export_budget','csv')}>Exportar orçamento CSV</button><button disabled={busy} onClick={()=>void downloadReport('export_budget','json')}>Exportar JSON</button><button disabled={busy} onClick={()=>void downloadReport('export_budget','pdf')}>Exportar PDF</button></div><div className="cbim-closeout-metrics">
    <Metric label="Total precificado (perdas e BDI)" value={money(budget.total_cost)} source="Somente grupos com composição válida"/>
    <Metric label="Grupos precificados" value={String(budget.matched_group_count)} source="Correspondência QTO × composição"/>
    <Metric label="Grupos sem composição" value={String(budget.unmatched_group_count)} source="Excluídos do total precificado"/>
   </div><p>Fonte: {budget.source} · Competência: {budget.reference_date} · BDI: {engineeringNumber(budget.bdi_percent)}%</p>
   {costDetails&&<p className="studio-muted" role="status">Memória do total precificado: custo-base {money(costDetails.baseCost)} + perdas {money(costDetails.wasteCost)} + BDI {money(costDetails.bdiCost)} = {money(costDetails.total)}. Referência: catálogo local do estudo.</p>}
    {budget.unmatched_group_count>0&&<p role="status">Orçamento parcial. Grupos não precificados não compõem o total exibido.</p>}
    <QuantitiesGrid mode="budget" records={budget.lines||[]}/>
   </>}
  </>}
  {tab==='4d'&&<>
    <div className="cbim-4d-import">
      <SchedulePreview busy={busy} existingIds={activities.map((a:any)=>a.activity_id)} onImport={async(csv)=>{
        const result=await run('import_schedule',{csv},'Cronograma CSV validado e importado pelo motor canônico.');
        if(!result)throw Error('Importação recusada; o cronograma anterior foi preservado.');
      }}/>
      <details className="cbim-4d-add-activity"><summary>Cadastrar atividade manualmente</summary>
        <form className="cbim-react-form-grid" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);
          void run('activity',{activity_id:f.get('id'),name:f.get('name'),start_date:f.get('start'),end_date:f.get('end'),
             composition_code:f.get('composition'),predecessors:String(f.get('predecessors')||'').split(/[;,]/).map(x=>x.trim()).filter(Boolean)},
             'Atividade salva com datas e dependências no cronograma canônico.');
        }}>
          <label>Código<input name="id" required/></label><label>Atividade<input name="name" required/></label>
          <label>Início<input type="date" name="start" required/></label><label>Fim<input type="date" name="end" required/></label>
          <label>Predecessoras (códigos)<input name="predecessors" placeholder="A01, A02"/></label>
          <label>Composição (opcional)<input name="composition"/></label>
          <button disabled={busy||!bridge()} type="submit">Adicionar atividade</button>
        </form>
      </details>
    </div>
    <Schedule4DWorkspace projectId={project.id} activities={activities} busy={busy} desktop={!!bridge()}
      onAction={run} onQuery={api}/>
  </>}
  {tab==='med'&&<Measurement5DWorkspace projectId={project.id} batches={batches}
    activities={activities} quantities={quant} budgetAvailable={!!overview?.budget}
    busy={busy} desktop={!!bridge()} initialGuid={guid} initialQuantity={quantity}
    onAction={run} onQuery={api}/>}
  {busy&&<EngineeringFeedback title="Processando operação BIM local" busy>Os dados serão confirmados apenas após resposta do motor Python.</EngineeringFeedback>}
  {error&&<EngineeringFeedback tone="danger" title="Operação BIM não concluída">{error} Nenhum valor foi preenchido automaticamente.</EngineeringFeedback>}
  {notice&&<EngineeringFeedback tone="success" title={notice}/>}
 </section>;
}
