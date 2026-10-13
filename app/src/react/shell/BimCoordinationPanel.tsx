import React from 'react';
import {CoordinationViewport} from './CoordinationViewport';
import {filterBimIssues} from '../../../../src/bim/studioExplorer.js';
import {clashDistance} from '../../../../src/domain/engineeringPresentation.js';
import {federarModelos,reconciliarConflitos,validarDecisaoConflito,compararRevisoesConflitos} from '../../../../src/bim/p2Coordination.js';
import {salvarAnaliseBimProjeto,registrarDecisaoConflitoBimProjeto,listarEventosConflitosBimProjeto,listarEstudosEngenhariaBim} from '../../../../storage/sqliteStore.js';
type Props={db:any;project:any;onChange:()=>void};
const runtime=()=> (globalThis as any).engineeringStorage?.bim;
const bytes=(base64:string)=>Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
function fileDownload(filename:string,buffer:Uint8Array,type:string){
 const url=URL.createObjectURL(new Blob([buffer],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function BimCoordinationPanel({db,project,onChange}:Props){
 const models=project.modelos||[],analyses=project.analises||[];
 const studies=listarEstudosEngenhariaBim(db,project.id);
 const [chosen,setChosen]=React.useState<string[]>([]);
 const [mode,setMode]=React.useState('intersection'),[tolerance,setTolerance]=React.useState('0.002'),[clearance,setClearance]=React.useState('0.05');
 const [filter,setFilter]=React.useState('todos'),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const [issueQuery,setIssueQuery]=React.useState('');
 const [selectedKey,setSelectedKey]=React.useState('');
 const [issuePage,setIssuePage]=React.useState(1);
 const [viewerGuid,setViewerGuid]=React.useState('');
 const [editing,setEditing]=React.useState(''),[status,setStatus]=React.useState('em_revisao'),[assignee,setAssignee]=React.useState(''),[due,setDue]=React.useState(''),[reason,setReason]=React.useState(''),[comment,setComment]=React.useState('');
 const picked=chosen.filter(id=>models.some((m:any)=>m.id===id));
 const selectedModels=models.filter((m:any)=>picked.includes(m.id));
 const latest=analyses[0];
 const latestModels=React.useMemo(()=>{
  try{const parsed=JSON.parse(latest?.modelos_json||'null');return Array.isArray(parsed)&&parsed.length?parsed:null;}
  catch{return null;}
 },[latest?.modelos_json]);
 const revisions=analyses[1]?compararRevisoesConflitos(analyses[1]?.conflitos||[],latest?.conflitos||[]):null;
 const issues=filterBimIssues((latest?.conflitos||[]).filter((c:any)=>filter==='todos'||(c.status||'aberto')===filter),issueQuery);
 const displayed=issues.slice((Math.min(issuePage,Math.max(1,Math.ceil(issues.length/30)))-1)*30,Math.min(issuePage,Math.max(1,Math.ceil(issues.length/30)))*30);
 const currentPage=Math.min(issuePage,Math.max(1,Math.ceil(issues.length/30)));
 const pageCount=Math.max(1,Math.ceil(issues.length/30));
 const selectedIssue=(latest?.conflitos||[]).find((c:any)=>c.chave===selectedKey)||null;
 const scopeModels=latestModels?.length
   ? models.filter((m:any)=>latestModels.some((source:any)=>source.id===m.id&&(!source.hash||source.hash===m.arquivo_hash)))
   : models;
 const missingAnalysisModels=latestModels?.length?latestModels.length-scopeModels.length:0;
 const onViewerSelection=React.useCallback((guids:string[])=>{
   const gids=guids.filter(Boolean);
   setViewerGuid(gids.join(' · '));
   const match=(latest?.conflitos||[]).find((c:any)=>gids.includes(c.aGlobalId)||gids.includes(c.bGlobalId));
   if(match){
     setFilter('todos');setIssueQuery('');
     const index=(latest?.conflitos||[]).findIndex((c:any)=>c.chave===match.chave);
     setIssuePage(Math.floor(index/30)+1);
     setSelectedKey(match.chave);
   }
 },[latest?.id]);
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
 return <section className="cbim-react-panel cbim-coordination"><div className="cbim-coordination-intro"><div><p className="cbim-coordination-overline">COORDENAÇÃO ESPACIAL · ESTUDO CANÔNICO</p><h2>Coordenação · Federação e conflitos (F4)</h2></div><span className="cbim-coordination-engine">{latest?.proveniencia==='ifcopenshell_real'?'Motor IfcOpenShell · IFC':latest?.proveniencia==='manifesto_bbox'?'Motor de envelopes · JSON':'Aguardando análise validada'}</span></div>
   <p>Selecione N modelos do mesmo formato. IFC é processado pelo IfcOpenShell; JSON usa envelopes geométricos simplificados, identificados como tal. Nenhum conflito desaparece automaticamente por mudar de revisão.</p>
   <div className="cbim-coordination-kpis" aria-label="Resumo verificável da última análise">
    <article><span>Conflitos</span><strong>{(latest?.conflitos||[]).length}</strong><small>Última análise registrada</small></article>
    <article><span>Abertos</span><strong>{(latest?.conflitos||[]).filter((c:any)=>(c.status||'aberto')==='aberto').length}</strong><small>Aguardando ação técnica</small></article>
    <article><span>Em revisão</span><strong>{(latest?.conflitos||[]).filter((c:any)=>c.status==='em_revisao').length}</strong><small>Com decisão pendente</small></article>
    <article><span>Resolvidos</span><strong>{(latest?.conflitos||[]).filter((c:any)=>c.status==='resolvido').length}</strong><small>Somente decisões explícitas</small></article>
   </div>
   <details className="cbim-coordination-settings"><summary>Modelos participantes e parâmetros da análise</summary>
   <div className="p2-model-list">{models.map((m:any)=><label key={m.id}><input type="checkbox" checked={picked.includes(m.id)} onChange={()=>toggle(m.id)}/>{m.nome} <small>{m.disciplina} · revisão {m.revisao} · {m.arquivo_nome}</small></label>)}</div>
   <div className="cbim-react-form-grid">
    <label>Tipo<select value={mode} onChange={e=>setMode(e.target.value)}><option value="intersection">Interseção</option><option value="collision">Colisão</option><option value="clearance">Afastamento</option></select></label>
    <label>Tolerância (m)<input type="number" min="0" max="1" step="any" value={tolerance} onChange={e=>setTolerance(e.target.value)}/></label>
    <label>Afastamento (m)<input type="number" min="0" max="100" step="any" value={clearance} onChange={e=>setClearance(e.target.value)}/></label>
   </div>
   <div className="cbim-react-toolbar"><button disabled={busy||picked.length<2} onClick={()=>void execute()}>{busy?'Analisando…':'Executar federação ('+picked.length+' modelos)'}</button>
    <button disabled={busy||!latest?.conflitos?.length||latest.proveniencia!=='ifcopenshell_real'} onClick={()=>void exportIssues('bcf')}>Exportar BCF 3.0 (IFC)</button><button disabled={busy||!latest?.conflitos?.length} onClick={()=>void exportIssues('csv')}>Pendências CSV</button><button disabled={busy||!latest?.conflitos?.length} onClick={()=>void exportIssues('pdf')}>Relatório PDF</button></div>
   </details>
   {latest&&<p className="studio-muted">Última execução: {latest.criado_em} · {latest.proveniencia||'motor não identificado'} · {(latest.conflitos||[]).length} pendências · {latestModels?latestModels.length+' modelos':'modelos participantes não registrados (análise legada)'}.</p>}
   {revisions&&<p role="status">Comparação com execução anterior: {revisions.novos.length} novos · {revisions.persistentes.length} persistentes · {revisions.reaparecidos.length} com evidência alterada · {revisions.naoObservados.length} não observados (sem resolução automática).</p>}
   <div className="cbim-coordination-split">
    <CoordinationViewport models={scopeModels} projectId={project.id} latest={latest} selectedIssue={selectedIssue} onViewerSelection={onViewerSelection}/>
    <section className="cbim-coordination-issues" aria-label="Conflitos e pendências BIM">
      <header className="cbim-coordination-panel-head"><div><h3>Conflitos e pendências ({(latest?.conflitos||[]).length})</h3><small>Selecione um conflito para localizar os GUIDs no modelo.</small></div></header>
      {missingAnalysisModels>0&&<p role="alert" className="cbim-coordination-warning">{missingAnalysisModels} modelo(s) da análise não corresponde(m) às revisões carregadas. Reimporte a revisão original para localizar todos os conflitos.</p>}
   <label>Filtrar conflitos<select value={filter} onChange={e=>{setFilter(e.target.value);setIssuePage(1);}}><option value="todos">Todos</option><option value="aberto">Abertos</option><option value="em_revisao">Em revisão</option><option value="resolvido">Resolvidos por decisão</option><option value="ignorado">Ignorados</option></select></label>
   <label>Buscar pendências (GUID, disciplina, arquivo, responsável)<input type="search" aria-label="Pesquisar conflitos BIM" value={issueQuery} onChange={e=>{setIssueQuery(e.target.value);setIssuePage(1);}} placeholder="Buscar na última análise"/></label>
   <p role="status">{issues.length} pendência(s) coincidem com os filtros de estado e pesquisa.</p>

   {!latest&&<p>Nenhuma federação executada. Selecione os modelos e execute para produzir evidência.</p>}
   {latest&&!issues.length&&<p>Nenhum conflito no filtro atual. Isso não equivale à aprovação de um projeto não revisado.</p>}
   {viewerGuid&&<p role="status" className="cbim-coordination-guid">Seleção do visualizador: {viewerGuid}</p>}
   <div className="p2-issues">{displayed.map((c:any,i:number)=><article key={c.chave||i} className={'p2-issue'+(selectedKey===c.chave?' is-selected':'')}>
     <strong>{c.aGlobalId||'Elemento A'} × {c.bGlobalId||'Elemento B'}</strong>
     <small>{(c.origens||[]).join(' ↔ ')} · {c.status||'aberto'} · {clashDistance(c.distanciaM)}</small>
     {c.revisaoAlterada&&<p role="status">Modelos alterados; decisão anterior não transferida.</p>}
     {(()=>{const linked=studies.filter((study:any)=>study.analise_id===latest.id&&study.conflito_chave===c.chave);
        return linked.length?<p className="studio-muted"><strong>{linked.length} memória(s) técnica(s) preliminar(es)</strong> · mais recente: {linked[0].titulo} · revisão registrada {linked[0].contexto.revisao}. Não resolve a pendência automaticamente.</p>:null;
     })()}
     <button type="button" className="cbim-issue-focus" aria-pressed={selectedKey===c.chave} onClick={()=>setSelectedKey(c.chave)}>Localizar no 3D</button>
     <button onClick={()=>{setSelectedKey(c.chave);setEditing(editing===c.chave?'':c.chave);setStatus(c.status||'em_revisao');setAssignee(c.responsavel||'');setDue(c.prazo||'');setReason(c.motivo||'');}}>Registrar decisão</button>
     {editing===c.chave&&<form onSubmit={e=>{e.preventDefault();saveDecision(c);}} className="cbim-react-form-grid">
       <label>Estado<select value={status} onChange={e=>setStatus(e.target.value)}><option value="aberto">Aberto</option><option value="em_revisao">Em revisão</option><option value="resolvido">Resolvido por decisão</option><option value="ignorado">Ignorado</option></select></label>
       <label>Responsável<input value={assignee} onChange={e=>setAssignee(e.target.value)} required={status==='resolvido'||status==='ignorado'}/></label>
       <label>Prazo<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
       <label>Motivo<input value={reason} onChange={e=>setReason(e.target.value)} required={status==='ignorado'}/></label>
       <label>Comentário<textarea value={comment} onChange={e=>setComment(e.target.value)}/></label>
       <button type="submit">Salvar decisão e auditoria</button>
     </form>}
   </article>)}</div>
   <nav className="cbim-coordination-pagination" aria-label="Paginação de conflitos"><span>Exibindo {displayed.length} de {issues.length} resultados · página {currentPage} de {pageCount}</span><div><button type="button" disabled={currentPage===1} onClick={()=>setIssuePage(p=>Math.max(1,p-1))}>Anterior</button><button type="button" disabled={currentPage===pageCount} onClick={()=>setIssuePage(p=>Math.min(pageCount,p+1))}>Próxima</button></div></nav>
   </section></div>
   {!!events.length&&<details><summary>Histórico de decisões ({events.length})</summary>{events.slice(0,30).map((e:any)=><p key={e.id}>{e.timestamp} · {e.conflito_chave} · {e.status} · {e.responsavel}</p>)}</details>}
   {error&&<p role="alert" className="cbim-react-error">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
 </section>;
}
