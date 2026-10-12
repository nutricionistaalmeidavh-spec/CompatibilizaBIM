import React from 'react';
import {listarModuleLinks,salvarModuleLink,registrarHistorico,salvarBanco} from '../../../../storage/sqliteStore.js';
import {REVIEW_LINK,parseTraceLink,prepareReviewLink} from '../../../../src/domain/p1Traceability.js';
type Props={db:any;project:any;workspaces:any[];busy:boolean;onReview:(path:string)=>void;onRefresh:()=>void;onChange:()=>void};
export function ReviewTraceabilityPanel({db,project,workspaces,busy,onReview,onRefresh,onChange}:Props){
 const [error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const records=listarModuleLinks(db).filter((x:any)=>x.module_id===REVIEW_LINK).map((x:any)=>({row:x,detail:parseTraceLink(x)})).filter((x:any)=>x.detail);
 const attach=(workspace:any)=>{
  setError('');setNotice('');
  try{
   if(!project)throw Error('Selecione um estudo BIM de origem antes de vincular a revisão.');
   const args=prepareReviewLink(project,workspace,records.map((x:any)=>x.row));
   const same=records.filter((x:any)=>x.detail.workspacePath===workspace.path&&x.detail.projectId===project.id);
   if(same.some((x:any)=>x.detail.revision===workspace.revision)){setNotice('Esta revisão já está vinculada ao estudo.');return;}
   salvarModuleLink(db,args);
   if(project.obra_id){registrarHistorico(db,project.obra_id,'revisao_cbim',project.id,'workspace_vinculado',{workspace:workspace.job,cbimProjectId:workspace.project_id,revision:workspace.revision});salvarBanco(db);}
   setNotice('Vínculo registrado no SQLite. Nenhum arquivo nem modelo foi copiado ou substituído.');
   onChange();
  }catch(e:any){setError(e.message||String(e));}
 };
 return <section className="cbim-react-panel" aria-label="Rastreabilidade da revisão CBIM">
  <h2>Revisão CBIM · origem e proveniência</h2>
  <p>Vincule explicitamente a revisão local a um estudo antes de abri-la. O ID do projeto no motor CBIM é distinto do ID do estudo SQLite; ambos são preservados no vínculo, com job, caminho e número da revisão.</p>
  <div className="cbim-react-toolbar"><button onClick={onRefresh} type="button" disabled={busy}>Atualizar workspaces do motor</button></div>
  {!project&&<p role="status">Selecione ou crie um estudo BIM para vincular a revisão.</p>}
  {workspaces.map((w:any)=>{
   const matches=records.filter((x:any)=>x.detail.workspacePath===w.path);
   const own=matches.filter((x:any)=>x.detail.projectId===project?.id).sort((a:any,b:any)=>b.detail.revision-a.detail.revision);
   const different=matches.find((x:any)=>x.detail.projectId!==project?.id);
   const upToDate=own.some((x:any)=>x.detail.revision===w.revision);
   return <article key={w.path} className="cbim-p1-review">
    <b>{w.project_name||w.job}</b>
    <p className="studio-muted">Job: {w.job} · ID CBIM: {w.project_id||'não informado'} · revisão local {w.revision} · {w.updated_at||'data não informada'}</p>
    <p>{different?'Origem registrada em outro estudo: '+different.detail.projectId:upToDate?'Vinculado ao estudo atual · revisão '+w.revision:own.length?'Revisão mais recente ainda não registrada neste estudo':'Sem vínculo com o estudo atual'}</p>
    <div className="cbim-react-toolbar">
     <button disabled={busy||!project||!!different||upToDate} type="button" onClick={()=>attach(w)}>{own.length?'Registrar nova revisão':'Vincular a este estudo'}</button>
     <button disabled={busy||!own.length||!!different} type="button" onClick={()=>onReview(w.path)}>Abrir revisão React</button>
    </div>
   </article>;
  })}
  {!workspaces.length&&<p>Nenhum workspace convertido encontrado. A importação/conversão e os dados existentes continuam preservados.</p>}
  {notice&&<p role="status">{notice}</p>}
  {error&&<p role="alert" className="cbim-react-error">{error}</p>}
  <p className="studio-muted">Exportar reviewed.cbim.json no revisor não substitui o IFC nem atualiza automaticamente um modelo do estudo. Volte a Importar no Estudo BIM para incluir uma revisão verificada como novo modelo.</p>
 </section>;
}
