
import React from 'react';
import { LinkedBimPanel } from './LinkedBimPanel';
import {listarProjetosBim,buscarProjetoBim,criarProjetoBimPersistido,salvarModeloBimProjeto,salvarAnaliseBimProjeto,atualizarConflitoBimProjeto} from '../../../../storage/sqliteStore.js';
import {criarModeloBim,detectarConflitosBim,validarCabecalhoIfc} from '../../../../src/bim/compatibility.js';
import {executarAnaliseBim,formatoModeloBim} from '../../../../src/bim/p0Workflow.js';
import {criarManifestoViewer,gerarViewerFederadoHtml} from '../../../../src/bim/viewer.js';

const runtime=()=> (globalThis as any).engineeringStorage?.bim;
const hash=(s:string)=>{let h=2166136261;for(const char of s){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16);};
const toBase64=async(file:File)=>{const bytes=new Uint8Array(await file.arrayBuffer());let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(out);};
const download=(name:string,text:string,type:string)=>{const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
type Props={db:any;obraId:string|null;version:number;onChange:()=>void};
export function BimPage({db,obraId,version,onChange}:Props) {
  const [id,setId]=React.useState('');
  const [creating,setCreating]=React.useState(false);
  const [left,setLeft]=React.useState('');
  const [right,setRight]=React.useState('');
  const [filter,setFilter]=React.useState('todos');
  const [busy,setBusy]=React.useState(false);
  const [message,setMessage]=React.useState('');
  const [progress,setProgress]=React.useState('');
  const [workspaces,setWorkspaces]=React.useState<any[]>([]);
  const [discipline,setDiscipline]=React.useState('hydraulic');
  const projects=listarProjetosBim(db);
  const selected=id||projects[0]?.id||'';
  const project=selected?buscarProjetoBim(db,selected):null;
  const models=project?.modelos||[];
  const analyses=project?.analises||[];
  const clashes=analyses.flatMap((a:any)=>(a.conflitos||[]).map((c:any)=>({...c,analiseId:a.id})));
  React.useEffect(()=>{runtime()?.listWorkspaces?.().then(setWorkspaces).catch(()=>setWorkspaces([]));},[version]);
  React.useEffect(()=>{if(!models.some((m:any)=>m.id===left))setLeft(models[0]?.id||'');if(!models.some((m:any)=>m.id===right))setRight(models[1]?.id||'');},[selected,version]);
  const run=async(job:()=>Promise<void>)=>{
    setBusy(true);setMessage('');
    try{await job();onChange();}catch(e:any){setMessage(e.message||String(e));}
    finally{setBusy(false);}
  };
  const create=(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const form=new FormData(e.currentTarget);
    try{const newid=criarProjetoBimPersistido(db,{nome:String(form.get('name')||''),descricao:String(form.get('description')||''),obraId:form.get('linked')==='on'?obraId:null});setId(newid);setCreating(false);onChange();}
    catch(e:any){setMessage(e.message);}
  };
  const importFile=async(file:File|null)=>{
    if(!file||!project)return;
    await run(async()=>{
      const isIfc=file.name.toLowerCase().endsWith('.ifc');
      const isJson=file.name.toLowerCase().endsWith('.json');
      if(!isIfc&&!isJson)throw Error('Selecione arquivo IFC ou JSON.');
      const sample=isIfc?await file.slice(0,4096).text():await file.text();
      if(isIfc&&!validarCabecalhoIfc(sample).valido)throw Error('Cabeçalho IFC-SPF inválido.');
      const data=isJson?JSON.parse(sample):null;
      const elements=data?.elementos||data?.elements||[];
      if(!Array.isArray(elements))throw Error('Manifesto sem lista de elementos válida.');
      salvarModeloBimProjeto(db,project.id,{nome:file.name,arquivoNome:file.name,arquivoHash:hash(sample),arquivoBase64:await toBase64(file),disciplina:discipline,elementos:elements});
      setMessage('Modelo original preservado no SQLite.');
    });
  };
  const analyze=()=>run(async()=>{
    if(!project||!left||!right||left===right)throw Error('Selecione dois modelos diferentes.');
    const a=models.find((m:any)=>m.id===left),b=models.find((m:any)=>m.id===right);
    if(!a||!b)throw Error('Modelo não encontrado.');
    const result=await executarAnaliseBim([a,b],{
      analisarIfc:runtime()?.clashBase64,
      analisarManifestos:([x,y]:any[])=>detectarConflitosBim(criarModeloBim(x),criarModeloBim(y),{modo:'intersection',afastamento:.05}),
      opcoes:{mode:'intersection',clearance:.05,tolerance:.002}
    });
    salvarAnaliseBimProjeto(db,project.id,{modeloAId:a.id,modeloBId:b.id,modo:'intersection',conflitos:result.conflitos,status:result.status});
    setMessage('Análise '+result.formato+' concluída: '+result.conflitos.length+' conflitos.');
  });
  const view=()=>run(async()=>{
    if(!project||!models.length)throw Error('Importe pelo menos um modelo.');
    if(models.some((m:any)=>formatoModeloBim(m)==='ifc')){
      if(!models.every((m:any)=>formatoModeloBim(m)==='ifc'&&m.arquivo_base64))throw Error('Use apenas modelos IFC originais no visualizador geométrico.');
      if(!runtime()?.generateViewerBase64)throw Error('Visualizador IFC requer runtime desktop.');
      const output=await runtime().generateViewerBase64(models.map((m:any)=>({name:m.arquivo_nome||m.nome,base64:m.arquivo_base64})));
      if(!output?.output)throw Error('Motor não confirmou o visualizador.');
    }else{
      if(!models.every((m:any)=>m.elementos?.length))throw Error('Manifesto não possui geometria.');
      download('viewer-bim-'+project.id+'.html',gerarViewerFederadoHtml(criarManifestoViewer(models,clashes)),'text/html');
    }
    setMessage('Visualizador gerado pelo motor existente.');
  });
  const convert=async(file:File|null)=>{
    if(!file)return;
    await run(async()=>{
      const bim=runtime();
      if(!bim?.convertDwgBase64)throw Error('A conversão DWG necessita do Electron.');
      if(!file.name.toLowerCase().endsWith('.dwg'))throw Error('Arquivo deve ser DWG.');
      const off=bim.onProgress?.((p:any)=>setProgress(p.stage||'Processando'));
      let result;
      try{result=await bim.convertDwgBase64({name:file.name,base64:await toBase64(file),discipline});}
      finally{off?.();setProgress('');}
      if(!result?.report?.ifc_sanity_passed)throw Error('Conversor não validou o IFC; nenhuma conclusão será registrada.');
      if(result.ifcBase64&&project)salvarModeloBimProjeto(db,project.id,{nome:result.ifcName,arquivoNome:result.ifcName,arquivoHash:hash(result.ifcBase64.slice(0,4096)),arquivoBase64:result.ifcBase64,disciplina:discipline,elementos:[]});
      setMessage('DWG convertido; revisão pendente: '+(result.report.review_pending_count||0)+' · artefatos: '+result.outputDir);
      setWorkspaces(await bim.listWorkspaces());
    });
  };
  const review=(path:string)=>run(async()=>{
    if(!runtime()?.openStudio)throw Error('Revisão requer o Electron.');
    await runtime().openStudio(path);
    setMessage('Projeto de revisão aberto.');
  });
  const changeClash=(a:string,i:number,status:string)=>{
    try{atualizarConflitoBimProjeto(db,a,i,status);onChange();}catch(e:any){setMessage(e.message);}
  };
  return <section className="cbim-react-section"><h1>Compatibilização BIM</h1><p>Importação, conversão e análise usam os contratos canônicos; resultado pendente não é apresentado como análise concluída.</p>
    <div className="cbim-react-toolbar"><label>Estudo BIM<select value={selected} onChange={e=>setId(e.target.value)}><option value="">Selecione estudo</option>{projects.map((p:any)=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><button onClick={()=>setCreating(v=>!v)}>+ Estudo</button></div>
    {creating&&<form className="cbim-react-panel cbim-react-form-grid" onSubmit={create}><label>Nome<input name="name" required/></label><label>Descrição<input name="description"/></label>{obraId&&<label><input type="checkbox" name="linked"/> Vincular à obra atual</label>}<button type="submit">Criar estudo</button></form>}
    {project&&<><div className="cbim-react-panel"><h2>{project.nome} · {models.length} modelos</h2>
      <div className="cbim-react-form-grid"><label>Disciplina<select value={discipline} onChange={e=>setDiscipline(e.target.value)}><option value="hydraulic">Hidráulica</option><option value="structure">Estrutura</option><option value="architecture">Arquitetura</option><option value="fire">Incêndio</option></select></label>
        <label>Importar IFC / JSON<input disabled={busy} type="file" accept=".ifc,.json" onChange={e=>{void importFile(e.target.files?.[0]||null);e.target.value='';}}/></label>
        <label>Converter DWG<input disabled={busy} type="file" accept=".dwg" onChange={e=>{void convert(e.target.files?.[0]||null);e.target.value='';}}/></label></div>
      {models.map((m:any)=><p key={m.id}>{m.nome} · {m.disciplina} · {m.elementos?.length||0} elementos</p>)}
      <div className="cbim-react-form-grid"><label>Modelo A<select value={left} onChange={e=>setLeft(e.target.value)}>{models.map((m:any)=><option value={m.id} key={m.id}>{m.nome}</option>)}</select></label><label>Modelo B<select value={right} onChange={e=>setRight(e.target.value)}>{models.map((m:any)=><option value={m.id} key={m.id}>{m.nome}</option>)}</select></label></div>
      <div className="cbim-react-toolbar"><button disabled={busy||models.length<2} onClick={analyze}>Analisar interferências</button><button disabled={busy||!models.length} onClick={view}>Gerar visualizador</button></div>
    </div>
    <div className="cbim-react-panel"><h2>Conflitos e decisões</h2><label>Estado<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="todos">Todos</option><option value="aberto">Abertos</option><option value="resolvido">Resolvidos</option><option value="ignorado">Ignorados</option></select></label>
      {!analyses.length&&<p>Não analisado. Nenhuma conclusão de ausência de conflitos foi emitida.</p>}
      {analyses.length>0&&!['concluida_ifc','concluida_manifesto'].includes(analyses[0].status)&&<p>Análise antiga sem rastreabilidade: reprocesse para confirmar.</p>}
      {clashes.filter((c:any)=>filter==='todos'||c.status===filter).map((c:any)=><article key={c.analiseId+'-'+c.indice}><b>#{c.indice} · {c.aGlobalId||'A'} × {c.bGlobalId||'B'}</b><small>{c.status||'aberto'}</small>
        <div className="cbim-react-toolbar"><button onClick={()=>changeClash(c.analiseId,c.indice,'resolvido')}>Resolver</button><button onClick={()=>changeClash(c.analiseId,c.indice,'ignorado')}>Ignorar</button><button onClick={()=>changeClash(c.analiseId,c.indice,'aberto')}>Reabrir</button></div></article>)}
    </div></>}
    <div className="cbim-react-panel"><h2>Revisão e histórico CBIM</h2><p>WorkspaceStore e histórico permanecem no local canônico, sem migração de arquivos.</p>
      {workspaces.map((w:any)=><article key={w.path}><b>{w.project_name}</b><small>{w.job} · revisão {w.revision} · {w.updated_at}</small><button disabled={busy} onClick={()=>review(w.path)}>Abrir revisão React</button></article>)}
      {!workspaces.length&&<p>Nenhum workspace convertido encontrado.</p>}
    </div>
    <LinkedBimPanel db={db} obraId={obraId} onChange={onChange}/>
    {(message||progress)&&<p role="status">{progress||message}</p>}
    {busy&&<p aria-busy="true">Processamento em andamento…</p>}
  </section>;
}
