import React from 'react';
import {listarMedicoes,listarModuleLinks,registrarConferenciaMedicaoAtomica} from '../../../../storage/sqliteStore.js';
import {MEASUREMENT_LINK,parseTraceLink,prepareMeasurementLink,summarizeMeasurementReconciliation} from '../../../../src/domain/p1Traceability.js';
import {quantityVarianceMessage} from '../../../../src/domain/engineeringJourney.js';
type Props={db:any;project:any;onChange:()=>void;target?:any;onNavigate?:(route:string,target?:any)=>void};
const bridge=()=> (globalThis as any).engineeringStorage?.bim?.p2;
const qty=(n:any)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:5}).format(Number(n)||0);
export function BimMeasurementReconciliationPanel({db,project,onChange,target,onNavigate}:Props){
 const [batches,setBatches]=React.useState<any[]>([]),[loading,setLoading]=React.useState(false);
 const [error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[actor,setActor]=React.useState('');
 const [choices,setChoices]=React.useState<Record<string,string>>({});
 const [search,setSearch]=React.useState('');
 const [filter,setFilter]=React.useState('todos');
 const [page,setPage]=React.useState(0);
 const rows=project?.obra_id?listarMedicoes(db,project.obra_id):[];
 const links=listarModuleLinks(db).filter((r:any)=>r.module_id===MEASUREMENT_LINK);
 const status=summarizeMeasurementReconciliation(project,batches,rows,links);
 const pending=status.filter((x:any)=>x.state==='nao_vinculada').length;
 const differences=status.filter((x:any)=>x.state==='divergente').length;
 const linked=status.filter((x:any)=>x.state==='conciliada').length;
 const invalid=status.filter((x:any)=>x.state==='referencia_invalida').length;
 const filtered=status.filter((x:any)=>(filter==='todos'||filter===x.state)&&
   (!search.trim()||[x.batchId,x.period,x.unit,x.operationalId,...x.guids].some(v=>String(v||'').toLowerCase().includes(search.trim().toLowerCase()))));
 const pageCount=Math.max(1,Math.ceil(filtered.length/8));
 const currentPage=Math.min(page,pageCount-1);
 const visible=filtered.slice(currentPage*8,currentPage*8+8);
 const refresh=async()=>{
  setError('');setLoading(true);
  try{if(!bridge()){setBatches([]);return;}const response=await bridge()({projectId:project.id,action:'status',params:{}});setBatches(Array.isArray(response?.measurements)?response.measurements:[]);}
  catch(e:any){setError(e.message||String(e));setBatches([]);}finally{setLoading(false);}
 };
 React.useEffect(()=>{void refresh();},[project.id]);
 const connect=(batch:any)=>{
  setNotice('');setError('');
  try{
   const row=rows.find((r:any)=>r.id===choices[batch.batch_id]);
   if(!row)throw Error('Selecione uma medição operacional aprovada.');
   const freshLinks=listarModuleLinks(db).filter((r:any)=>r.module_id===MEASUREMENT_LINK);
   const args=prepareMeasurementLink(project,batch,row,freshLinks,actor);
   registrarConferenciaMedicaoAtomica(db,args,{estudo:project.id,medicaoOperacional:row.id,periodo:batch.period,guids:JSON.parse(args.source).guids,usuario:actor});
   setNotice('Conferência registrada com histórico no mesmo commit SQLite. Os valores originais foram preservados.');onChange();
  }catch(e:any){setError(e.message||String(e));}
 };
 return <section className="cbim-react-panel cbim-5d-conciliation" data-testid="cbim-5d-reconciliation" aria-label="Conciliação entre medições BIM e obra">
   <div className="cbim-5d-recon-hero"><div><span>CONFERÊNCIA / BIM × OPERAÇÃO</span><h2>Conferência de medições</h2>
    <p>Associe registros aprovados da mesma obra, competência e unidade. A diferença requer julgamento humano; não duplica medições, pagamentos ou receita.</p></div></div>
   <div className="cbim-5d-recon-kpis" aria-label="Situação da conferência canônica">
      <article><span>Aguardando vínculo</span><strong>{pending}</strong><small>Sem associação operacional</small></article>
      <article><span>Conferidas</span><strong>{linked}</strong><small>Quantidade equivalente</small></article>
      <article><span>Divergências</span><strong>{differences}</strong><small>Exigem validação técnica</small></article>
      <article><span>Referência inválida</span><strong>{invalid}</strong><small>Vínculo preservado para revisão</small></article>
   </div>
   {target?.kind==='bim-conciliacao'&&<p role="status">Retorno à conferência BIM {target.id}. Se o lote não aparecer, atualize as medições BIM ou confira a revisão do estudo.</p>}
   {!project?.obra_id?<p role="status">Este estudo é independente. Vincule a obra ao estudo para conferir medições; nenhuma associação automática foi presumida.</p>:<>
    <div className="cbim-react-toolbar"><button disabled={loading||!bridge()} type="button" onClick={()=>void refresh()}>{loading?'Carregando…':'Atualizar medições BIM'}</button></div>
    {!bridge()&&<p role="status">O motor local 4D/5D está disponível apenas no desktop. Registros operacionais não foram simulados.</p>}
    <div className="cbim-5d-recon-controls">
      <label>Responsável pela conferência<input value={actor} onChange={e=>setActor(e.target.value)} placeholder="Responsável técnico"/></label>
      <label>Pesquisar lote ou GUID<input type="search" aria-label="Pesquisar conferências BIM" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Lote, competência, GUID…"/></label>
      <label>Estado<select aria-label="Filtrar conferências BIM" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}>
        <option value="todos">Todos</option><option value="nao_vinculada">Aguardando vínculo</option>
        <option value="conciliada">Conferidas</option><option value="divergente">Divergências</option>
        <option value="referencia_invalida">Referências inválidas</option></select></label>
    </div>
    <div className="cbim-5d-recon-list">{visible.map(item=>{
     const batch=batches.find((b:any)=>b.batch_id===item.batchId);
     const candidates=rows.filter((r:any)=>r.status==='aprovada'&&r.periodo===item.period&&r.unidade===item.unit);
     const linkedOps=links.map((r:any)=>parseTraceLink(r)).filter(Boolean).map((r:any)=>r.operationalId);
     return <article key={item.batchId} className={'p2-measure cbim-5d-recon-card'+(target?.kind==='bim-conciliacao'&&target.id===item.batchId?' cbim-journey-focus':'')}>
      <div className="cbim-5d-recon-card-head"><strong>{item.batchId} · {item.period}</strong>
        <span className={'cbim-5d-recon-status '+item.state}>{item.state==='conciliada'?'Conferida':item.state==='divergente'?'Divergência de quantidade':item.state==='referencia_invalida'?'Referência desatualizada':'Aguardando vínculo'}</span></div>
      <div className="cbim-5d-recon-comparison"><div><small>Incremental BIM aprovado</small><strong>{qty(item.bimQuantity)} {item.unit||'unidades diversas'}</strong><span>{item.guids.length} GUID(s) com origem no QTO</span></div>
        <div><small>Medição operacional aprovada</small><strong>{item.operationalQuantity==null?'Sem associação':qty(item.operationalQuantity)+' '+item.unit}</strong><span>{item.operationalId||'Pendente de vínculo explícito'}</span></div>
        <div><small>Diferença física (BIM − operação)</small><strong>{item.delta==null?'Não calculada':qty(item.delta)+' '+item.unit}</strong><span>Sem conversão de unidades ou acerto automático</span></div></div>
      {item.state==='divergente'&&<p role="status">{quantityVarianceMessage(item.delta,item.unit)} A diferença exige conferência humana; valores físicos e financeiros continuam separados.</p>}
      {item.state==='referencia_invalida'&&<p role="alert">A medição vinculada não está mais válida neste contexto. Consulte o registro de origem; o vínculo não foi apagado.</p>}
      {onNavigate&&<div className="cbim-react-toolbar">
       {item.operationalId&&<button type="button" onClick={()=>onNavigate('Operação',{kind:'medicao',id:item.operationalId,obraId:project.obra_id,studyId:project.id,period:item.period,origin:{kind:'bim-conciliacao',id:item.batchId,studyId:project.id,obraId:project.obra_id}})}>Ver medição de origem</button>}
       {item.period&&<button type="button" onClick={()=>onNavigate('RDO',{kind:'rdo-competencia',period:item.period,obraId:project.obra_id,studyId:project.id,origin:{kind:'bim-conciliacao',id:item.batchId,studyId:project.id,obraId:project.obra_id}})}>Consultar RDOs da competência</button>}
      </div>}
      {item.state==='nao_vinculada'&&<div className="cbim-react-form-grid">
        <label>Medição operacional<select aria-label={'Medição operacional para '+item.batchId} value={choices[item.batchId]||''} onChange={e=>setChoices(v=>({...v,[item.batchId]:e.target.value}))}>
         <option value="">Selecione medição aprovada</option>{candidates.filter((r:any)=>!linkedOps.includes(r.id)).map((r:any)=><option value={r.id} key={r.id}>{r.descricao} · {r.periodo} · {qty(r.quantidade)} {r.unidade}</option>)}
        </select></label><button type="button" disabled={!actor.trim()||!choices[item.batchId]||loading||!bridge()} onClick={()=>connect(batch)}>Registrar conferência rastreável</button>
       </div>}
     </article>;
    })}</div>
    {!status.length&&<p className="cbim-5d-empty">Nenhuma medição BIM aprovada disponível. Registre e aprove medições no módulo 5D antes da conferência.</p>}
    {status.length>0&&!visible.length&&<p className="cbim-5d-empty">Nenhuma conferência corresponde aos filtros.</p>}
    <nav className="cbim-5d-recon-pagination" aria-label="Páginas de conferências"><span>Exibindo {visible.length?currentPage*8+1:0}–{Math.min((currentPage+1)*8,filtered.length)} de {filtered.length}</span>
      <button type="button" disabled={currentPage===0} onClick={()=>setPage(v=>Math.max(0,v-1))}>Anterior</button>
      <button type="button" disabled={currentPage>=pageCount-1} onClick={()=>setPage(v=>Math.min(pageCount-1,v+1))}>Próxima</button></nav>
   </>}
   {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="cbim-react-error">{error}</p>}
 </section>;
}
