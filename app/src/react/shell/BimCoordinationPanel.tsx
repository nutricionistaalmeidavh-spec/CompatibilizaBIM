import React from 'react';
import {federarModelos,reconciliarConflitos,validarDecisaoConflito,compararRevisoesConflitos} from '../../../../src/bim/p2Coordination.js';
import {salvarAnaliseBimProjeto,registrarDecisaoConflitoBimProjeto,listarEventosConflitosBimProjeto} from '../../../../storage/sqliteStore.js';
type Props={db:any;project:any;onChange:()=>void};
const runtime=()=> (globalThis as any).engineeringStorage?.bim;
const bytes=(base64:string)=>Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
function fileDownload(filename:string,buffer:Uint8Array,type:string){
 const url=URL.createObjectURL(new Blob([buffer],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function BimCoordinationPanel({db,project,onChange}:Props){
 const models=project.modelos||[],analyses=project.analises||[];
 const [chosen,setChosen]=React.useState<string[]>([]);
 const [mode,setMode]=React.useState('intersection'),[tolerance,setTolerance]=React.useState('0.002'),[clearance,setClearance]=React.useState('0.05');
 const [filter,setFilter]=React.useState('todos'),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const [editing,setEditing]=React.useState(''),[status,setStatus]=React.useState('em_revisao'),[assignee,setAssignee]=React.useState(''),[due,setDue]=React.useState(''),[reason,setReason]=React.useState(''),[comment,setComment]=React.useState('');
 const picked=chosen.filter(id=>models.some((m:any)=>m.id===id));
 const selectedModels=models.filter((m:any)=>picked.includes(m.id));
 const latest=analyses[0];
 const revisions=analyses[1]?compararRevisoesConflitos(analyses[1]?.conflitos||[],latest?.conflitos||[]):null;
 const issues=(latest?.conflitos||[]).filter((c:any)=>filter==='todos'||(c.status||'aberto')===filter);
 const events=latest?listarEventosConflitosBimProjeto(db,latest.id):[];
 const toggle=(id:string)=>setChosen(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
 const execute=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   if(selectedModels.length<2)throw Error('Selecione dois ou mais modelos diferentes.');
   const options={modo:mode,tolerancia:Number(tolerance),afastamento:Number(clearance)};
   const report=await federarModelos(selectedModels,options,{analisarIfc:runtime()?.clashBase64});
   const previous=analyses.flatMap((a:any)=>a.conflitos||[]).filter((c:any)=>c.chave);
   const conflicts=reconciliarConflitos(report.conflitos,previous);
   salvarAnaliseBimProjeto(db,project.id,{modeloAId:selectedModels[0].id,modeloBId:selectedModels[1].id,
     modelos:report.modelos,modo:report.modo,tolerancia:report.tolerancia,afastamento:report.afastamento,
     conflitos:conflicts,proveniencia:report.motor,status:'concluida_'+report.formato});
   onChange();setNotice('Federação concluída: '+report.pairs.length+' pares analisados, '+conflicts.length+' conflitos. Motor: '+report.motor+'. Os conflitos anteriores continuam no histórico.');
  }catch(e:any){setError(e.message||String(e));}finally{setBusy(false);}
 };
 const saveDecision=(issue:any)=>{
  try{
    setError('');
    const data=validarDecisaoConflito({status,responsavel:assignee,prazo:due,motivo:reason,comentario:comment});
    registrarDecisaoConflitoBimProjeto(db,latest.id,issue.chave,data);
    setEditing('');setComment('');onChange();setNotice('Decisão registrada no histórico, com responsável e data.');
  }catch(e:any){setError(e.message||String(e));}
 };
 const exportIssues=async(format:'bcf'|'csv'|'pdf')=>{
  setBusy(true);setError('');
  try{
   if(format==='bcf'&&latest?.proveniencia!=='ifcopenshell_real')throw Error('BCF com GUID IFC exige compatibilização por motor IFC real; não exporte bbox como IFC.');
   if(!(latest?.conflitos||[]).length)throw Error('Nenhum conflito para exportar.');
   const response=await runtime()?.p2?.({projectId:project.id,action:'bcf',
     params:{projectId:project.id,issues:latest.conflitos,author:'CompatibilizaBIM Studio',format}});
   if(!response?.base64)throw Error('BCF não retornou arquivo.');
   fileDownload(response.name,bytes(response.base64),format==='bcf'?'application/zip':format==='pdf'?'application/pdf':'text/csv');
   setNotice(response.format+' gerado com '+response.issue_count+' pendências rastreadas.');
  }catch(e:any){setError(e.message||String(e));}finally{setBusy(false);}
 };
 return <section className="cbim-react-panel"><h2>Coordenação · Federação e conflitos (F4)</h2>
   <p>Selecione N modelos do mesmo formato. IFC é processado pelo IfcOpenShell; JSON usa envelopes geométricos simplificados, identificados como tal. Nenhum conflito desaparece automaticamente por mudar de revisão.</p>
   <div className="p2-model-list">{models.map((m:any)=><label key={m.id}><input type="checkbox" checked={picked.includes(m.id)} onChange={()=>toggle(m.id)}/>{m.nome} <small>{m.disciplina} · revisão {m.revisao} · {m.arquivo_nome}</small></label>)}</div>
   <div className="cbim-react-form-grid">
    <label>Tipo<select value={mode} onChange={e=>setMode(e.target.value)}><option value="intersection">Interseção</option><option value="collision">Colisão</option><option value="clearance">Afastamento</option></select></label>
    <label>Tolerância (m)<input type="number" min="0" max="1" step="any" value={tolerance} onChange={e=>setTolerance(e.target.value)}/></label>
    <label>Afastamento (m)<input type="number" min="0" max="100" step="any" value={clearance} onChange={e=>setClearance(e.target.value)}/></label>
   </div>
   <div className="cbim-react-toolbar"><button disabled={busy||picked.length<2} onClick={()=>void execute()}>{busy?'Analisando…':'Executar federação ('+picked.length+' modelos)'}</button>
    <button disabled={busy||!latest?.conflitos?.length||latest.proveniencia!=='ifcopenshell_real'} onClick={()=>void exportIssues('bcf')}>Exportar BCF 3.0 (IFC)</button><button disabled={busy||!latest?.conflitos?.length} onClick={()=>void exportIssues('csv')}>Pendências CSV</button><button disabled={busy||!latest?.conflitos?.length} onClick={()=>void exportIssues('pdf')}>Relatório PDF</button></div>
   {latest&&<p className="studio-muted">Última execução: {latest.criado_em} · {latest.proveniencia||'motor não identificado'} · {(latest.conflitos||[]).length} pendências · {JSON.parse(latest.modelos_json||'[]').length||2} modelos.</p>}
   {revisions&&<p role="status">Comparação com execução anterior: {revisions.novos.length} novos · {revisions.persistentes.length} persistentes · {revisions.reaparecidos.length} com evidência alterada · {revisions.naoObservados.length} não observados (sem resolução automática).</p>}
   <label>Filtrar conflitos<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="todos">Todos</option><option value="aberto">Abertos</option><option value="em_revisao">Em revisão</option><option value="resolvido">Resolvidos por decisão</option><option value="ignorado">Ignorados</option></select></label>
   {!latest&&<p>Nenhuma federação executada. Selecione os modelos e execute para produzir evidência.</p>}
   {latest&&!issues.length&&<p>Nenhum conflito no filtro atual. Isso não equivale à aprovação de um projeto não revisado.</p>}
   <div className="p2-issues">{issues.slice(0,250).map((c:any,i:number)=><article key={c.chave||i} className="p2-issue">
     <strong>{c.aGlobalId||'Elemento A'} × {c.bGlobalId||'Elemento B'}</strong>
     <small>{(c.origens||[]).join(' ↔ ')} · {c.status||'aberto'} · distância {Number(c.distanciaM||0).toFixed(3)} m</small>
     {c.revisaoAlterada&&<p role="status">Modelos alterados; decisão anterior não transferida.</p>}
     <button onClick={()=>{setEditing(editing===c.chave?'':c.chave);setStatus(c.status||'em_revisao');setAssignee(c.responsavel||'');setDue(c.prazo||'');setReason(c.motivo||'');}}>Registrar decisão</button>
     {editing===c.chave&&<form onSubmit={e=>{e.preventDefault();saveDecision(c);}} className="cbim-react-form-grid">
       <label>Estado<select value={status} onChange={e=>setStatus(e.target.value)}><option value="aberto">Aberto</option><option value="em_revisao">Em revisão</option><option value="resolvido">Resolvido por decisão</option><option value="ignorado">Ignorado</option></select></label>
       <label>Responsável<input value={assignee} onChange={e=>setAssignee(e.target.value)} required={status==='resolvido'||status==='ignorado'}/></label>
       <label>Prazo<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
       <label>Motivo<input value={reason} onChange={e=>setReason(e.target.value)} required={status==='ignorado'}/></label>
       <label>Comentário<textarea value={comment} onChange={e=>setComment(e.target.value)}/></label>
       <button type="submit">Salvar decisão e auditoria</button>
     </form>}
   </article>)}</div>
   {issues.length>250&&<p>Exibindo as primeiras 250 pendências. Refine o filtro ou exporte o BCF para revisão completa.</p>}
   {!!events.length&&<details><summary>Histórico de decisões ({events.length})</summary>{events.slice(0,30).map((e:any)=><p key={e.id}>{e.timestamp} · {e.conflito_chave} · {e.status} · {e.responsavel}</p>)}</details>}
   {error&&<p role="alert" className="cbim-react-error">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
 </section>;
}
