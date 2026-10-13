import React from 'react';
import {CanonicalGantt,type ScheduleProposal} from './CanonicalGantt';

type Props={
 activities:any[];busy:boolean;desktop:boolean;projectId:string;
 onAction:(action:string,params:any,success:string)=>Promise<any>;
 onQuery:(action:string,params:any)=>Promise<any>;
};
const pct=(value:any)=>Math.max(0,Math.min(100,Number(value)||0));
const dateToday=()=>{
 const d=new Date();
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
const statusLabel=(a:any)=>{
 if(pct(a.actual_progress)===100)return 'Concluída';
 if(pct(a.actual_progress)>0)return 'Em execução';
 return 'Não iniciada';
};
const filterActivity=(a:any,q:string)=>{
 const needle=q.toLocaleLowerCase('pt-BR').trim();
 return !needle||[a.activity_id,a.name,a.discipline,a.storey,a.composition_code,...(a.predecessors||[]),...(a.linked_guids||[])].some((part:any)=>String(part||'').toLocaleLowerCase('pt-BR').includes(needle));
};
export function Schedule4DWorkspace({activities,busy,desktop,projectId,onAction,onQuery}:Props){
 const [query,setQuery]=React.useState('');
 const [scope,setScope]=React.useState('todas');
 const [selectedId,setSelectedId]=React.useState('');
 const [dates,setDates]=React.useState({start:'',end:'',predecessors:''});
 const [progress,setProgress]=React.useState('0');
 const [reference,setReference]=React.useState(dateToday);
 const [pending,setPending]=React.useState<ScheduleProposal|null>(null);
 const [resetKey,setResetKey]=React.useState(0);
 const [guidQuery,setGuidQuery]=React.useState('');
 const [guidPage,setGuidPage]=React.useState(0);
 const [guidResults,setGuidResults]=React.useState<any[]>([]);
 const [guidCount,setGuidCount]=React.useState(0);
 const [pickedGuid,setPickedGuid]=React.useState('');
 const [lookupBusy,setLookupBusy]=React.useState(false);
 const [lookupNotice,setLookupNotice]=React.useState('');
 const [simulation,setSimulation]=React.useState<any|null>(null);
 const [simulationBusy,setSimulationBusy]=React.useState(false);
 const [localError,setLocalError]=React.useState('');
 const active=activities.find((x:any)=>x.activity_id===selectedId)||null;
 const select=React.useCallback((id:string)=>{setSelectedId(id);setPending(null);},[]);
 React.useEffect(()=>{
   if(active){
     setDates({start:active.start_date||'',end:active.end_date||'',predecessors:(active.predecessors||[]).join(', ')});
     setProgress(String(pct(active.actual_progress)));
   }
 },[selectedId,active?.start_date,active?.end_date,JSON.stringify(active?.predecessors||[]),active?.actual_progress]);
 React.useEffect(()=>{
   setSelectedId('');setPending(null);setGuidQuery('');setGuidResults([]);setGuidCount(0);setSimulation(null);setLocalError('');
 },[projectId]);
 const visible=React.useMemo(()=>activities.filter((a:any)=>filterActivity(a,query)&&(
   scope==='todas'||(scope==='vinculadas'&&a.linked_guids?.length)||
   (scope==='sem-vinculo'&&!a.linked_guids?.length)||
   (scope==='concluidas'&&pct(a.actual_progress)===100)
 )),[activities,query,scope]);
 const linked=activities.filter((a:any)=>a.linked_guids?.length).length;
 const finished=activities.filter((a:any)=>pct(a.actual_progress)===100).length;
 const dependencies=activities.filter((a:any)=>a.predecessors?.length).length;
 const mean=activities.length?activities.reduce((sum:number,a:any)=>sum+pct(a.actual_progress),0)/activities.length:0;
 const onPropose=React.useCallback((next:ScheduleProposal)=>{setPending(next);setLocalError('');},[]);
 const revert=()=>{setPending(null);setResetKey(x=>x+1);};
 const applyProposal=async()=>{
   if(!pending||!desktop||busy)return;
   const original=activities.find((a:any)=>a.activity_id===pending.activityId);
   if(!original){setLocalError('A atividade mudou. Atualize o cronograma.');return;}
   const action=pending.kind==='dates'?'reschedule':'progress';
   const params=pending.kind==='dates'?
    {activity_id:pending.activityId,start_date:pending.startDate,end_date:pending.endDate,predecessors:original.predecessors||[]}:
    {activity_id:pending.activityId,progress:pending.progress,recorded_on:reference};
   const result=await onAction(action,params,'Alteração confirmada pelo motor e salva no cronograma local.');
   if(result){revert();setSimulation(null);}
   else{setResetKey(x=>x+1);}
 };
 const saveDates=async()=>{
   if(!active||busy||!desktop)return;
   setLocalError('');
   const predecessors=dates.predecessors.split(/[;,]/).map(x=>x.trim()).filter(Boolean);
   if(predecessors.includes(active.activity_id)){setLocalError('A atividade não pode depender de si mesma.');return;}
   const result=await onAction('reschedule',{activity_id:active.activity_id,start_date:dates.start,end_date:dates.end,predecessors},
      'Datas e dependências revalidadas e salvas pelo motor 4D.');
   if(result){revert();setSimulation(null);}
 };
 const saveProgress=async()=>{
   if(!active||busy||!desktop)return;
   const amount=Number(progress);
   if(!Number.isFinite(amount)||amount<0||amount>100){setLocalError('Progresso deve estar entre 0 e 100%.');return;}
   const result=await onAction('progress',{activity_id:active.activity_id,progress:amount,recorded_on:reference},
     'Avanço físico acumulado registrado na data indicada, sem gerar medição ou pagamento.');
   if(result){revert();setSimulation(null);}
 };
 const lookup=async(offset=0)=>{
   setLookupNotice('');setLocalError('');
   if(guidQuery.trim().length<2){setLookupNotice('Informe pelo menos 2 caracteres do GUID, elemento ou arquivo IFC.');return;}
   if(!desktop){setLookupNotice('Busca no conjunto completo de IFC exige o aplicativo desktop.');return;}
   setLookupBusy(true);
   try{
     const data=await onQuery('guid_lookup',{search:guidQuery.trim(),offset,limit:40});
     setGuidResults(data.entries||[]);setGuidCount(Number(data.total)||0);setGuidPage(offset);setPickedGuid('');
     if(!data.total)setLookupNotice('Nenhum elemento IFC com QTO verificável foi encontrado.');
   }catch(e:any){setLookupNotice(e.message||String(e));setGuidResults([]);setGuidCount(0);}
   finally{setLookupBusy(false);}
 };
 const link=async()=>{
   if(!active||!pickedGuid||!desktop)return;
   const result=await onAction('link',{activity_id:active.activity_id,guids:[pickedGuid]},
       'GUID IFC validado no QTO e associado à atividade selecionada.');
   if(result){setPickedGuid('');setSimulation(null);}
 };
 const simulate=async()=>{
   if(!desktop||busy)return;
   setSimulationBusy(true);setLocalError('');
   try{setSimulation(await onQuery('simulate',{date:reference}));}
   catch(e:any){setLocalError(e.message||String(e));}
   finally{setSimulationBusy(false);}
 };
 return <div className="cbim-4d-workspace" data-testid="cbim-4d-workspace">
   <header className="cbim-4d-hero"><div><span className="cbim-4d-eyebrow">PLANEJAMENTO · VÍNCULO BIM 4D</span>
     <h3>Cronograma de atividades</h3>
     <p>Datas, precedências, vínculos e avanço são lidos do cronograma canônico. Nenhuma alteração é salva sem ação explícita.</p>
   </div><div className="cbim-4d-hero-stat"><strong>{activities.length}</strong><small>Atividades cadastradas</small></div></header>
   <div className="cbim-4d-kpis">
     <article><span>Avanço médio informado</span><strong>{mean.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</strong><small>Média simples dos registros, não medição aprovada</small></article>
     <article><span>Com vínculo IFC</span><strong>{linked}<small> / {activities.length}</small></strong><small>GUID confirmado por QTO</small></article>
     <article><span>Concluídas</span><strong>{finished}</strong><small>Avanço registrado = 100%</small></article>
     <article><span>Com predecessoras</span><strong>{dependencies}</strong><small>Dependências do cronograma</small></article>
   </div>
   <section className="cbim-4d-surface" aria-label="Planejamento Gantt">
     <div className="cbim-4d-toolbar">
       <label>Buscar atividades<input type="search" aria-label="Buscar atividades no Gantt" placeholder="Código, descrição, disciplina ou GUID…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
       <label>Visualizar<select value={scope} onChange={e=>setScope(e.target.value)}><option value="todas">Todas as atividades</option><option value="vinculadas">Vinculadas ao IFC</option><option value="sem-vinculo">Sem vínculo IFC</option><option value="concluidas">Concluídas</option></select></label>
       <small>{visible.length} de {activities.length} atividades</small>
     </div>
     <CanonicalGantt activities={visible} editable={desktop&&!busy&&!pending} onSelect={select} onPropose={onPropose} resetKey={resetKey}/>
     {pending&&<div className="cbim-4d-proposal" role="status"><div><strong>Alteração ainda não salva</strong>
       <p>{pending.kind==='dates'?
        `${pending.activityId}: ${pending.startDate||'—'} → ${pending.endDate||'—'}`:
        `${pending.activityId}: avanço físico ${pending.progress}% em ${reference}`}</p>
       <small>O motor validará predecessoras e datas antes de substituir o cronograma local.</small></div>
       <button type="button" disabled={!desktop||busy} onClick={()=>void applyProposal()}>Confirmar alteração</button>
       <button type="button" onClick={revert}>Descartar</button>
     </div>}
     <div className="cbim-4d-table-wrap"><table aria-label="Atividades e dependências do cronograma"><thead><tr><th>Atividade</th><th>Início</th><th>Fim</th><th>Dependências</th><th>Avanço</th><th>IFC</th><th>Ação</th></tr></thead><tbody>
       {visible.map((a:any)=><tr key={a.activity_id} className={a.activity_id===active?.activity_id?'is-selected':''}>
         <td><b>{a.name}</b><small>{a.activity_id} · {a.discipline||'Sem disciplina'}</small></td>
         <td>{a.start_date}</td><td>{a.end_date}</td><td>{(a.predecessors||[]).join(', ')||'—'}</td>
         <td><div className="cbim-4d-progress"><span style={{width:pct(a.actual_progress)+'%'}}/></div><small>{pct(a.actual_progress)}% · {statusLabel(a)}</small></td>
         <td><strong>{a.linked_guids?.length||0}</strong></td>
         <td><button type="button" onClick={()=>select(a.activity_id)}>{active?.activity_id===a.activity_id?'Selecionada':'Detalhar'}</button></td>
       </tr>)}
       {!visible.length&&<tr><td colSpan={7}>Nenhuma atividade corresponde aos filtros. Ajuste a busca ou importe um cronograma.</td></tr>}
     </tbody></table></div>
   </section>
   <section className="cbim-4d-inspector" aria-label="Detalhes e vínculos da atividade">
     <div className="cbim-4d-section-head"><h4>Atividade selecionada</h4><small>Alterações somente pelo motor local</small></div>
     {!active&&<div className="cbim-4d-empty">Selecione uma atividade no Gantt ou na tabela para editar datas, vínculos e registrar o avanço.</div>}
     {active&&<><div className="cbim-4d-active"><strong>{active.activity_id} · {active.name}</strong><span>{statusLabel(active)} · {(active.linked_guids||[]).length} elemento(s) IFC vinculados</span></div>
       <div className="cbim-4d-editor">
         <section><h5>Planejamento e dependências</h5><div className="cbim-4d-editor-fields">
           <label>Início<input type="date" aria-label="Início da atividade" disabled={!desktop||busy} value={dates.start} onChange={e=>setDates(v=>({...v,start:e.target.value}))}/></label>
           <label>Fim<input type="date" aria-label="Fim da atividade" disabled={!desktop||busy} value={dates.end} onChange={e=>setDates(v=>({...v,end:e.target.value}))}/></label>
           <label className="cbim-4d-editor-wide">Predecessoras por código<input aria-label="Predecessoras da atividade" disabled={!desktop||busy} value={dates.predecessors} placeholder="Ex.: A01, A02" onChange={e=>setDates(v=>({...v,predecessors:e.target.value}))}/></label>
         </div><button type="button" disabled={!desktop||busy} onClick={()=>void saveDates()}>Validar e salvar planejamento</button>
         <p>Datas e dependências são validadas contra o grafo completo; em caso de erro, a versão anterior permanece salva.</p></section>
         <section><h5>Avanço físico informado</h5><div className="cbim-4d-editor-fields">
           <label>Data de referência<input type="date" aria-label="Data de referência 4D" value={reference} onChange={e=>setReference(e.target.value)}/></label>
           <label>Avanço acumulado (%)<input aria-label="Avanço físico da atividade" type="number" min="0" max="100" step=".1" disabled={!desktop||busy} value={progress} onChange={e=>setProgress(e.target.value)}/></label>
         </div><button type="button" disabled={!desktop||busy} onClick={()=>void saveProgress()}>Registrar avanço com data</button>
         <p>Progresso físico não aprova medição, custo ou pagamento.</p></section>
       </div>
       <section className="cbim-4d-link"><h5>Vínculo com elementos IFC da atividade</h5>
         <p>Pesquise diretamente no QTO integral do estudo. O resultado não é limitado aos primeiros 300 ou 800 registros.</p>
         <div className="cbim-4d-search"><input type="search" aria-label="Pesquisar GUID no IFC completo" placeholder="GUID, elemento, classe ou arquivo…" value={guidQuery} onChange={e=>{setGuidQuery(e.target.value);setGuidResults([]);setGuidCount(0);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void lookup(0);}}}/>
         <button type="button" disabled={!desktop||lookupBusy||guidQuery.trim().length<2} onClick={()=>void lookup(0)}>{lookupBusy?'Buscando…':'Buscar no IFC'}</button></div>
         {(guidResults.length>0)&&<><div className="cbim-4d-search-results" role="group" aria-label="Resultados da busca IFC">{guidResults.map((r:any)=><button type="button" key={r.global_id+'|'+r.source_file} aria-pressed={pickedGuid===r.global_id} onClick={()=>setPickedGuid(r.global_id)}>
           <strong>{r.global_id}</strong><span>{r.element_name||r.ifc_class} · {r.source_file} · {r.storey||'Sem pavimento'}</span></button>)}</div>
           <div className="cbim-4d-search-pages"><span>Exibindo {guidPage+1}–{Math.min(guidPage+guidResults.length,guidCount)} de {guidCount} elementos</span>
             <button type="button" disabled={lookupBusy||guidPage===0} onClick={()=>void lookup(Math.max(0,guidPage-40))}>Anterior</button>
             <button type="button" disabled={lookupBusy||guidPage+40>=guidCount} onClick={()=>void lookup(guidPage+40)}>Próxima</button>
           </div></>}
         {lookupNotice&&<p role="status">{lookupNotice}</p>}
         <button type="button" disabled={!desktop||busy||!pickedGuid||(active.linked_guids||[]).includes(pickedGuid)} onClick={()=>void link()}>Vincular GUID selecionado</button>
         {!!(active.linked_guids||[]).length&&<div className="cbim-4d-linked">{active.linked_guids.map((id:string)=><code key={id}>{id}</code>)}</div>}
       </section>
     </>}
   </section>
   <section className="cbim-4d-simulation"><div className="cbim-4d-section-head"><div><h4>Simulação 4D por data</h4><small>Motor determinístico do estudo</small></div><button type="button" disabled={!desktop||!activities.length||simulationBusy} onClick={()=>void simulate()}>{simulationBusy?'Calculando…':'Simular 4D'}</button></div>
     {simulation&&<><div className="cbim-4d-sim-stats">
       <article>Previsto <strong>{simulation.overall.planned_progress}%</strong></article>
       <article>Real informado <strong>{simulation.overall.actual_progress}%</strong></article>
       <article>Desvio <strong>{simulation.overall.variance_percent} p.p.</strong></article>
     </div>{simulation.curve?.length>1&&<svg className="cbim-4d-curve" viewBox="0 0 620 190" role="img" aria-label="Curva S da simulação canônica">
       {[0,25,50,75,100].map(value=><g key={value}><line x1="37" x2="600" y1={171-value*1.48} y2={171-value*1.48} stroke="#e3eaf5"/><text x="4" y={175-value*1.48} fontSize="10" fill="#60718a">{value}%</text></g>)}
       {(['planned_progress','actual_progress'] as const).map((field,i)=><polyline key={field} fill="none" stroke={i?'#17916d':'#2167e8'} strokeWidth="2.8" points={simulation.curve.map((r:any,n:number)=>(37+n*563/(simulation.curve.length-1))+','+(171-pct(r[field])*1.48)).join(' ')}/>)}
     </svg>}<p>Azul: previsto · Verde: real registrado. Curva calculada pelo motor Python, sem estimativas inventadas.</p></>}
   </section>
   {localError&&<p role="alert" className="cbim-react-error">{localError}</p>}
   {!desktop&&<p role="status">Modo web: visualização disponível; salvar cronograma, buscar QTO e calcular a simulação exigem o aplicativo desktop offline.</p>}
 </div>;
}
