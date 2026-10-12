import React from 'react';
import {listarMedicoes,listarModuleLinks,salvarModuleLink,registrarHistorico,salvarBanco} from '../../../../storage/sqliteStore.js';
import {MEASUREMENT_LINK,parseTraceLink,prepareMeasurementLink,summarizeMeasurementReconciliation} from '../../../../src/domain/p1Traceability.js';
type Props={db:any;project:any;onChange:()=>void};
const bridge=()=> (globalThis as any).engineeringStorage?.bim?.p2;
const qty=(n:any)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:5}).format(Number(n)||0);
export function BimMeasurementReconciliationPanel({db,project,onChange}:Props){
 const [batches,setBatches]=React.useState<any[]>([]),[loading,setLoading]=React.useState(false);
 const [error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[actor,setActor]=React.useState('');
 const [choices,setChoices]=React.useState<Record<string,string>>({});
 const rows=project?.obra_id?listarMedicoes(db,project.obra_id):[];
 const links=listarModuleLinks(db).filter((r:any)=>r.module_id===MEASUREMENT_LINK);
 const status=summarizeMeasurementReconciliation(project,batches,rows,links);
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
   const args=prepareMeasurementLink(project,batch,row,links,actor);
   salvarModuleLink(db,args);
   registrarHistorico(db,project.obra_id,'conciliacao_medicao',batch.batch_id,'referencia_vinculada',{estudo:project.id,medicaoOperacional:row.id,periodo:batch.period,guids:JSON.parse(args.source).guids,usuario:actor});
   salvarBanco(db);setNotice('Conferência registrada. Os totais financeiros e físicos originais não foram alterados.');onChange();
  }catch(e:any){setError(e.message||String(e));}
 };
 return <section className="cbim-react-panel" aria-label="Conciliação entre medições BIM e obra">
   <h2>Conferência BIM × medição operacional</h2>
   <p>As medições por GUID vêm do motor CBIM; as medições de serviço vêm do SQLite. Associação manual somente entre registros aprovados, da mesma competência e unidade. O confronto não gera outra medição, pagamento ou receita.</p>
   {!project?.obra_id?<p role="status">Este estudo é independente. Vincule a obra ao estudo para conferir medições; nenhuma associação automática foi presumida.</p>:<>
    <div className="cbim-react-toolbar"><button disabled={loading||!bridge()} type="button" onClick={()=>void refresh()}>{loading?'Carregando…':'Atualizar medições BIM'}</button></div>
    {!bridge()&&<p role="status">O motor local 4D/5D está disponível apenas no desktop. Registros operacionais não foram simulados.</p>}
    <label>Responsável pela conferência<input value={actor} onChange={e=>setActor(e.target.value)} placeholder="Nome de quem conferiu a equivalência"/></label>
    {status.map(item=>{
     const batch=batches.find((b:any)=>b.batch_id===item.batchId);
     const candidates=rows.filter((r:any)=>r.status==='aprovada'&&r.periodo===item.period&&r.unidade===item.unit);
     const linkedOps=links.map((r:any)=>parseTraceLink(r)).filter(Boolean).map((r:any)=>r.operationalId);
     return <article key={item.batchId} className="p2-measure">
      <strong>{item.batchId} · {item.period} · {item.state==='conciliada'?'Conferida':item.state==='divergente'?'Divergência de quantidade':item.state==='referencia_invalida'?'Referência desatualizada':'Pendente de vínculo'}</strong>
      <p>BIM: {qty(item.bimQuantity)} {item.unit||'unidades diversas'} · {item.guids.length} GUID(s) · {item.operationalQuantity==null?'Sem medição operacional associada':'Operação: '+qty(item.operationalQuantity)+' '+item.unit+' · diferença: '+qty(item.delta)}</p>
      {item.state==='divergente'&&<p role="status">A diferença exige conferência humana; os valores continuam separados.</p>}
      {item.state==='nao_vinculada'&&<div className="cbim-react-form-grid">
        <label>Medição operacional<select aria-label={'Medição operacional para '+item.batchId} value={choices[item.batchId]||''} onChange={e=>setChoices(v=>({...v,[item.batchId]:e.target.value}))}>
         <option value="">Selecione medição aprovada</option>{candidates.filter((r:any)=>!linkedOps.includes(r.id)).map((r:any)=><option value={r.id} key={r.id}>{r.descricao} · {r.periodo} · {qty(r.quantidade)} {r.unidade}</option>)}
        </select></label><button type="button" disabled={!actor.trim()||!choices[item.batchId]} onClick={()=>connect(batch)}>Registrar conferência</button>
       </div>}
     </article>;
    })}
    {!status.length&&<p>Nenhuma medição BIM aprovada disponível. Registre e aprove medições na aba 4D/5D antes da conferência.</p>}
   </>}
   {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="cbim-react-error">{error}</p>}
 </section>;
}
