import React from 'react';
import {criarManifestoViewer,gerarViewerFederadoHtml} from '../../../../src/bim/viewer.js';
import {formatoModeloBim} from '../../../../src/bim/p0Workflow.js';

type Props={
  models:any[];projectId:string;latest:any;selectedIssue:any;
  onViewerSelection:(guids:string[])=>void
};
const runtime=()=> (globalThis as any).engineeringStorage?.bim;
const validBox=(e:any)=>{
 const box=e?.bbox||e?.bounds;
 return Boolean(box&&[box.min,box.max].every((v:any)=>Array.isArray(v)&&v.length===3&&v.every((x:any)=>Number.isFinite(Number(x)))));
};
export function CoordinationViewport({models,projectId,latest,selectedIssue,onViewerSelection}:Props){
 const frame=React.useRef<HTMLIFrameElement>(null);
 const [native,setNative]=React.useState<{html:string;source:string;maxElementsPerFile:number}|null>(null);
 const [working,setWorking]=React.useState(false);
 const [error,setError]=React.useState('');
 const [loaded,setLoaded]=React.useState(false);
 const formats=[...new Set(models.map((m:any)=>formatoModeloBim(m)))];
 const format=formats.length===1?formats[0]:'mixed';
 const modelRevision=models.map((m:any)=>String(m.id)+'|'+String(m.arquivo_hash)+'|'+String(m.revisao)).join(';');
 React.useEffect(()=>{setNative(null);setLoaded(false);setError('');},[projectId,modelRevision]);
 const usable=React.useMemo(()=>models.map((model:any)=>({...model,elementos:(model.elementos||[]).filter(validBox)})),[models]);
 const drawable=usable.reduce((sum:number,model:any)=>sum+model.elementos.length,0);
 const missing=models.reduce((sum:number,model:any)=>sum+(model.elementos||[]).length,0)-drawable;
 const manifest=React.useMemo(()=>{
   if(format!=='manifesto'||!drawable)return null;
   return criarManifestoViewer(usable,latest?.proveniencia==='manifesto_bbox'?(latest.conflitos||[]):[]);
 },[usable,latest?.id,format,drawable]);
 const html=React.useMemo(()=>{
   if(format==='ifc')return native?.html||'';
   return manifest?gerarViewerFederadoHtml(manifest):'';
 },[native,manifest,format]);
 const focus=React.useCallback((guids:string[])=>{
   frame.current?.contentWindow?.postMessage({type:'cbim-viewer-focus',guids},'*');
 },[]);
 React.useEffect(()=>{
   if(loaded&&html)focus([selectedIssue?.aGlobalId,selectedIssue?.bGlobalId].filter((id):id is string=>typeof id==='string'&&!!id));
 },[loaded,html,selectedIssue?.chave,focus]);
 React.useEffect(()=>{
   const listen=(event:MessageEvent)=>{
     if(event.source!==frame.current?.contentWindow||!event.data||typeof event.data!=='object')return;
     if(event.data.type==='cbim-viewer-ready'){
       setLoaded(true);
       focus([selectedIssue?.aGlobalId,selectedIssue?.bGlobalId].filter((id):id is string=>typeof id==='string'&&!!id));
     }
     if(event.data.type==='cbim-viewer-selection'&&Array.isArray(event.data.guids)){
       onViewerSelection(event.data.guids.filter((id:any)=>typeof id==='string'&&id.length<=128).slice(0,2));
     }
   };
   window.addEventListener('message',listen);
   return()=>window.removeEventListener('message',listen);
 },[selectedIssue?.chave,onViewerSelection,focus]);
 const renderIfc=async()=>{
   setWorking(true);setError('');setLoaded(false);
   try{
     if(!runtime()?.renderInlineViewer)throw Error('Malhas IFC exigem o aplicativo desktop com IfcOpenShell.');
     if(!models.length||!models.every((m:any)=>m.arquivo_base64))throw Error('Reimporte os IFC originais antes da visualização geométrica.');
     const result=await runtime().renderInlineViewer(models.map((m:any)=>({name:m.arquivo_nome||m.nome,base64:m.arquivo_base64})));
     if(!result?.html||result.source!=='ifcopenshell_real')throw Error('O motor IFC não retornou o visualizador geométrico.');
     setNative(result);
   }catch(e:any){setError(e.message||String(e));}
   finally{setWorking(false);}
 };
 const hasPreview=Boolean(html);
 return <section className="cbim-coordination-viewport" aria-label="Visualizador geométrico de coordenação">
   <header className="cbim-coordination-panel-head"><div><h3>Modelo federado</h3><small>{models.length} modelo(s) no estudo · {format==='ifc'?'Malhas IFC reais (IfcOpenShell)':format==='manifesto'?'Envelopes geométricos CBIM JSON':'Formatos mistos'}</small></div>
     {format==='ifc'&&<button type="button" disabled={working} onClick={()=>void renderIfc()}>{working?'Gerando malhas…':native?'Atualizar 3D':'Carregar 3D IFC'}</button>}
   </header>
   <div className="cbim-coordination-frame">
     {hasPreview?
       <iframe ref={frame} key={projectId+'-'+modelRevision+'-'+format} title="Visualizador BIM 3D integrado" sandbox="allow-scripts allow-downloads" referrerPolicy="no-referrer"
         srcDoc={html} onLoad={()=>{setLoaded(true);focus([selectedIssue?.aGlobalId,selectedIssue?.bGlobalId].filter(Boolean));}}/>:
       <div className="cbim-coordination-frame-empty" role="status">
         <strong>{!models.length?'Nenhum modelo importado.':format==='ifc'?'Malhas IFC prontas para carregar':format==='manifesto'?'Não há envelopes geométricos válidos':'Modelos de formatos diferentes'}</strong>
         <p>{!models.length?'Importe IFC ou CBIM JSON no passo Estudo.':format==='ifc'?'Use “Carregar 3D IFC” no aplicativo desktop. A geometria será extraída dos IFC originais, sem trocar o motor.':format==='manifesto'?'Os elementos permanecem na lista, mas não existe bbox XYZ para representá-los.':'A visualização federada exige modelos do mesmo formato. Nenhuma geometria será inventada.'}</p>
       </div>}
     {working&&<div className="cbim-coordination-frame-progress" role="status">Extraindo malhas IFC pelo motor local…</div>}
   </div>
   {error&&<p role="alert" className="cbim-react-error">{error}</p>}
   <footer className="cbim-coordination-viewport-footer">
      <span>{format==='ifc'?(native?'Malhas reais extraídas; até 2.500 elementos por IFC.':'Processamento IFC disponível somente no desktop.'):`${drawable} envelopes geométricos válidos · ${missing} sem geometria`}</span>
      <button type="button" disabled={!hasPreview} onClick={()=>focus([])}>Enquadrar tudo</button>
   </footer>
   <div className="cbim-coordination-models" aria-label="Modelos do estudo">
      {models.map((model:any)=><div key={model.id}><strong>{model.nome}</strong><small>{model.disciplina} · revisão {model.revisao||1} · {model.arquivo_hash?.startsWith('sha256:')?'SHA-256':'Identificador original'}</small></div>)}
   </div>
   <p className="cbim-coordination-geometry-note">{format==='ifc'?'O visor WebGL usa triângulos extraídos pelo IfcOpenShell. Clique em um conflito para focar seus GUIDs; eventuais elementos excedentes exigem outra consulta.':format==='manifesto'?'3D baseado em bbox XYZ fornecida pelo manifesto CBIM; não é malha IFC/BREP.':'Nenhuma análise geométrica foi simulada.'}</p>
 </section>;
}
