
import React from 'react';
import {filterBimFiles,summarizeBimAlerts} from '../../../../src/bim/studioExplorer.js';
import {checkImportFile,readCbimElements,contentFingerprint} from './importContract.js';
import { LinkedBimPanel } from './LinkedBimPanel';
import { BimCoordinationPanel } from './BimCoordinationPanel';
import { Bim4D5DPanel } from './Bim4D5DPanel';
import { ReviewTraceabilityPanel } from './ReviewTraceabilityPanel';
import { BimMeasurementReconciliationPanel } from './BimMeasurementReconciliationPanel';
import {listarProjetosBim,buscarProjetoBim,vincularProjetoBimObra,criarProjetoBimPersistido,salvarModeloBimProjeto,salvarAnaliseBimProjeto,atualizarConflitoBimProjeto} from '../../../../storage/sqliteStore.js';
import {criarModeloBim,detectarConflitosBim,validarCabecalhoIfc} from '../../../../src/bim/compatibility.js';
import {executarAnaliseBim,formatoModeloBim} from '../../../../src/bim/p0Workflow.js';
import {criarManifestoViewer,gerarViewerFederadoHtml} from '../../../../src/bim/viewer.js';

const runtime=()=> (globalThis as any).engineeringStorage?.bim;
const fingerprint=async(file:File)=>contentFingerprint(new Uint8Array(await file.arrayBuffer()));
const toBase64=async(file:File)=>{const bytes=new Uint8Array(await file.arrayBuffer());let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(out);};
const download=(name:string,text:string,type:string)=>{const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
type Props={db:any;obraId:string|null;version:number;onChange:()=>void;studyId?:string;onSelectStudy?:(id:string)=>void;target?:any;onNavigate?:(route:string,target?:any)=>void};
export function BimPage({db,obraId,version,onChange,studyId='',onSelectStudy,target,onNavigate}:Props) {
  const [creating,setCreating]=React.useState(false);
  const [step,setStep]=React.useState<'Estudo'|'Coordenação'|'4D/5D'|'Revisão CBIM'|'Legado da obra'>('Estudo');
  const [left,setLeft]=React.useState('');
  const [right,setRight]=React.useState('');
  const [filter,setFilter]=React.useState('todos');
  const [busy,setBusy]=React.useState(false);
  const [message,setMessage]=React.useState('');
  const [error,setError]=React.useState('');
  const [unitlessScale,setUnitlessScale]=React.useState('1');
  const [fileQuery,setFileQuery]=React.useState('');
  const [progress,setProgress]=React.useState('');
  React.useEffect(()=>{if(target?.kind==='bim-conciliacao')setStep('4D/5D');},[target?.kind,target?.id]);
  const [workspaces,setWorkspaces]=React.useState<any[]>([]);
  const [discipline,setDiscipline]=React.useState('hydraulic');
  const projects=listarProjetosBim(db);
  const selected=projects.some((p:any)=>p.id===studyId)?studyId:'';
  const project=selected?buscarProjetoBim(db,selected):null;
  const models=project?.modelos||[];
  const analyses=project?.analises||[];
  const clashes=analyses.flatMap((a:any)=>(a.conflitos||[]).map((c:any)=>({...c,analiseId:a.id})));
  React.useEffect(()=>{runtime()?.listWorkspaces?.().then(setWorkspaces).catch(()=>setWorkspaces([]));},[version]);
  React.useEffect(()=>{if(!models.some((m:any)=>m.id===left))setLeft(models[0]?.id||'');if(!models.some((m:any)=>m.id===right))setRight(models[1]?.id||'');},[selected,version]);
  const run=async(job:()=>Promise<void>)=>{
    setBusy(true);setMessage('');setError('');
    try{await job();onChange();}catch(e:any){setError(e.message||String(e));}
    finally{setBusy(false);}
  };
  const create=(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const form=new FormData(e.currentTarget);
    try{const newid=criarProjetoBimPersistido(db,{nome:String(form.get('name')||''),descricao:String(form.get('description')||''),obraId:form.get('linked')==='on'?obraId:null});onSelectStudy?.(newid);setCreating(false);onChange();}
    catch(e:any){setMessage(e.message);}
  };
  const importFile=async(file:File|null)=>{
    if(!file||!project)return;
    await run(async()=>{
      const format=checkImportFile(file);
      if(format==='dwg'||format==='dxf')throw Error('Use a opção Converter CAD para reconhecer DWG/DXF antes de revisar.');
      const header=format==='ifc'?await file.slice(0,4096).text():'';
      if(format==='ifc'&&!validarCabecalhoIfc(header).valido)throw Error('Arquivo IFC sem cabeçalho STEP válido; não foi importado.');
      const elements=format==='json'?readCbimElements(await file.text()):[];
      const identity=await fingerprint(file);
      if(models.some((m:any)=>m.arquivo_hash===identity))throw Error('Este arquivo já está cadastrado neste estudo. Escolha outra revisão.');
      salvarModeloBimProjeto(db,project.id,{
        nome:file.name,arquivoNome:file.name,arquivoHash:identity,
        arquivoBase64:await toBase64(file),disciplina:discipline,elementos:elements
      });
      setMessage(format==='ifc'
        ? 'Arquivo IFC original guardado no projeto. A geometria deve ser validada no motor IFC desktop.'
        : 'Modelo CBIM JSON incorporado e preservado no SQLite; verifique as classificações antes de analisar.');
    });
  };
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
      const format=checkImportFile(file);
      if(format!=='dwg'&&format!=='dxf')throw Error('A conversão CAD aceita somente DWG ou DXF.');
      const off=bim.onProgress?.((p:any)=>setProgress(p.stage||'Processando'));
      let result;
      try{result=await bim.convertDwgBase64({name:file.name,base64:await toBase64(file),discipline,unitlessScaleToM:format==='dxf'?Number(unitlessScale):undefined});}
      finally{off?.();setProgress('');}
      if(!result?.report?.ifc_sanity_passed)throw Error('Conversor não validou o IFC; nenhuma conclusão será registrada.');
      if(result.ifcBase64&&project)salvarModeloBimProjeto(db,project.id,{nome:result.ifcName,arquivoNome:result.ifcName,arquivoHash:contentFingerprint(Uint8Array.from(atob(result.ifcBase64),c=>c.charCodeAt(0))),arquivoBase64:result.ifcBase64,disciplina:discipline,elementos:[]});
      setMessage(format.toUpperCase()+' convertido com IFC validado; pendências de revisão: '+(result.report.review_pending_count||0)+'. '+(result.report.warnings||[]).join(' · ')+' · Arquivos locais: '+result.outputDir);
      setWorkspaces(await bim.listWorkspaces());
    });
  };
  const review=(path:string)=>run(async()=>{
    if(!runtime()?.openStudio)throw Error('Revisão requer o Electron.');
    await runtime().openStudio(path);
    setMessage('Projeto de revisão aberto.');
  });
  return <section className="cbim-react-section"><h1>Compatibilização BIM</h1><p>Importação, conversão e análise usam os contratos canônicos; resultado pendente não é apresentado como análise concluída.</p>
    <div className="cbim-react-toolbar"><label>Estudo BIM<select value={selected} onChange={e=>onSelectStudy?.(e.target.value)}><option value="">Selecione estudo</option>{projects.map((p:any)=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><button onClick={()=>setCreating(v=>!v)}>+ Estudo</button></div>
    {creating&&<form className="cbim-react-panel cbim-react-form-grid" onSubmit={create}><label>Nome<input name="name" required/></label><label>Descrição<input name="description"/></label>{obraId&&<label><input type="checkbox" name="linked"/> Vincular à obra atual</label>}<button type="submit">Criar estudo</button></form>}
    {project&&<p className="studio-muted">Contexto: {project.obra_id?'Estudo vinculado à obra '+(project.obra_id===obraId?'atual.':'de origem '+project.obra_id+'.'):'Estudo BIM independente.'} {project.obra_id&&obraId&&project.obra_id!==obraId?'A obra selecionada no cabeçalho não altera o conteúdo deste estudo.':''}</p>}
    {project&&!project.obra_id&&obraId&&<div className="cbim-react-panel"><p>Este estudo é independente. Para conferir medições de serviço da obra, vincule-o explicitamente ao cadastro operacional. Modelos e revisões existentes não serão alterados.</p><button type="button" onClick={()=>{try{vincularProjetoBimObra(db,project.id,obraId);setMessage('Estudo vinculado à obra. Medições operacionais disponíveis para conferência.');setError('');onChange();}catch(e:any){setError(e.message||String(e));}}}>Vincular estudo à obra atual</button></div>}
    <nav className="cbim-p1-steps" aria-label="Etapas do estudo BIM">{(['Estudo','Coordenação','4D/5D','Revisão CBIM','Legado da obra'] as const).map(item=><button key={item} type="button" className={step===item?'selected':''} aria-pressed={step===item} onClick={()=>setStep(item)}>{item}</button>)}</nav>
    {project&&step==='Estudo'&&<div className="cbim-react-panel"><h2>{project.nome} · {models.length} modelos</h2>
      <div className="cbim-react-form-grid"><label>Disciplina<select value={discipline} onChange={e=>setDiscipline(e.target.value)}><option value="hydraulic">Hidráulica</option><option value="structure">Estrutura</option><option value="architecture">Arquitetura</option><option value="fire">Incêndio</option></select></label>
        <label>Importar IFC / CBIM JSON<input disabled={busy} type="file" accept=".ifc,.json,.cbim.json" onChange={e=>{void importFile(e.target.files?.[0]||null);e.target.value='';}}/></label>
        <label>Converter CAD (DWG / DXF)<input disabled={busy} type="file" accept=".dwg,.dxf" onChange={e=>{void convert(e.target.files?.[0]||null);e.target.value='';}}/></label><label>DXF sem unidade<select value={unitlessScale} disabled={busy} onChange={e=>setUnitlessScale(e.target.value)}><option value="1">Metros (m)</option><option value="0.01">Centímetros (cm)</option><option value="0.001">Milímetros (mm)</option></select></label></div><p className="studio-muted">Selecione a disciplina antes da importação. DWG usa ACadSharp; DXF usa ezdxf e respeita unidades INSUNITS. A escala acima só se aplica quando não há unidade declarada. XREFs ausentes são diagnosticados; o original e o relatório ficam no job local.</p>
      <label>Explorar modelos do estudo<input type="search" aria-label="Buscar modelos do estudo" value={fileQuery}
        onChange={e=>setFileQuery(e.target.value)} placeholder="Nome, revisão, disciplina ou arquivo"/></label>
      <p role="status" className="studio-muted">{filterBimFiles(models,fileQuery).length} de {models.length} arquivo(s) encontrados no estudo.</p>
      <div className="cbim-file-explorer">{filterBimFiles(models,fileQuery).map((m:any)=><article key={m.id}>
       <strong>{m.nome}</strong><small>{m.disciplina} · revisão {m.revisao||1} · {m.arquivo_nome||'arquivo local'}</small>
       <small>{m.elementos?.length||0} elementos catalogados no SQLite{String(m.arquivo_nome||'').toLowerCase().endsWith('.ifc')?' · geometria IFC exige motor desktop':''}</small>
       <small>Identificador existente: {m.arquivo_hash||'ausente'} · Não usar como SHA-256 se não declarado</small>
      </article>)}</div>
      {models.length>0&&!filterBimFiles(models,fileQuery).length&&<p>Nenhum modelo encontrado. Limpe o filtro para visualizar os demais.</p>}
      <div className="cbim-react-toolbar"><button disabled={busy||!models.length} onClick={view}>Gerar visualizador geométrico</button></div>
    </div>}
    {project&&step==='Coordenação'&&<p role="status" className="cbim-react-panel">
      {(()=>{const x=summarizeBimAlerts(clashes);return x.total+' conflitos registrados · '+x.pending+' abertos/em revisão · '+x.resolved+' resolvidos por decisão explícita. Sem aprovação automática.';})()}
    </p>}
    {project&&step==='Coordenação'&&<BimCoordinationPanel db={db} project={project} onChange={onChange}/>}
    {project&&step==='4D/5D'&&<><Bim4D5DPanel key={project.id} project={project}/><BimMeasurementReconciliationPanel key={project.id} db={db} project={project} onChange={onChange} target={target} onNavigate={onNavigate}/></>}
    {!project&&['Coordenação','4D/5D'].includes(step)&&<div className="cbim-react-panel">Selecione um estudo para acessar suas análises e quantitativos.</div>}
    {step==='Revisão CBIM'&&<ReviewTraceabilityPanel db={db} project={project} workspaces={workspaces} busy={busy} onReview={review} onRefresh={()=>{void runtime()?.listWorkspaces?.().then(setWorkspaces).catch(()=>setWorkspaces([]));}} onChange={onChange}/>}
    {step==='Legado da obra'&&<><p className="studio-muted">Modelos e conflitos gravados diretamente na obra, mantidos no SQLite original. Não são somados às análises dos estudos BIM e não serão migrados automaticamente.</p><LinkedBimPanel db={db} obraId={obraId} onChange={onChange}/></>}
    {(message||progress)&&<p role="status">{progress||message}</p>}
    {error&&<p role="alert" className="cbim-react-error">{error} Os arquivos existentes foram preservados; corrija a fonte ou consulte o log local antes de tentar novamente.</p>}
    {busy&&<div aria-busy="true" className="cbim-react-toolbar"><p>Processamento em andamento…</p><button type="button" onClick={()=>{void runtime()?.cancel?.();setProgress('Cancelamento solicitado; conferindo encerramento do job…');}}>Cancelar job</button></div>}
  </section>;
}
