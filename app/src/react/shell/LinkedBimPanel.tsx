import React from 'react';
import { buscarObra, salvarModeloBim, salvarAnaliseBim, atualizarConflitoBim, salvarPendencia } from '../../../../storage/sqliteStore.js';
import { criarModeloBim, detectarConflitosBim, validarCabecalhoIfc } from '../../../../src/bim/compatibility.js';
import { executarAnaliseBim, formatoModeloBim } from '../../../../src/bim/p0Workflow.js';
import { criarManifestoViewer, gerarViewerFederadoHtml } from '../../../../src/bim/viewer.js';
const runtime=()=> (globalThis as any).engineeringStorage?.bim;
const hash=(text:string)=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
async function base64(file:File){
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(binary);
}
function download(name:string,data:string,kind:string){
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([data],{type:kind}));
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function LinkedBimPanel({db,obraId,onChange}:{db:any;obraId:string|null;onChange:()=>void}){
  const [modelA,setModelA]=React.useState(''),[modelB,setModelB]=React.useState('');
  const [discipline,setDiscipline]=React.useState('hydraulic');
  const [filter,setFilter]=React.useState('todos'),[search,setSearch]=React.useState('');
  const [busy,setBusy]=React.useState(false),[message,setMessage]=React.useState('');
  const work=obraId?buscarObra(db,obraId):null;
  const models=work?.bimModelos||[],analyses=work?.bimAnalises||[];
  const left=models.some((m:any)=>m.id===modelA)?modelA:models[0]?.id||'';
  const right=models.some((m:any)=>m.id===modelB)?modelB:models[1]?.id||'';
  const all=analyses.flatMap((a:any)=>(a.conflitos||[]).map((c:any)=>({...c,analiseId:a.id})));
  const rows=all.filter((c:any)=>(filter==='todos'||c.status===filter)&&
    (!search||JSON.stringify(c).toLowerCase().includes(search.toLowerCase())));
  const execute=async(fn:()=>Promise<void>)=>{
    if(busy)return;setBusy(true);setMessage('');
    try{await fn();onChange();}catch(e:any){setMessage(e.message||String(e));}
    finally{setBusy(false);}
  };
  const upload=(file:File|null)=>execute(async()=>{
    if(!work||!file)throw Error('Selecione uma obra e um arquivo.');
    const ifc=file.name.toLowerCase().endsWith('.ifc');
    if(!ifc&&!file.name.toLowerCase().endsWith('.json'))throw Error('Formato permitido: IFC ou manifesto JSON.');
    const text=ifc?await file.slice(0,4096).text():await file.text();
    if(ifc&&!validarCabecalhoIfc(text).valido)throw Error('Cabeçalho IFC-SPF inválido.');
    const parsed=ifc?null:JSON.parse(text);
    const elementos=parsed?.elementos||parsed?.elements||[];
    if(!Array.isArray(elementos))throw Error('Elementos do manifesto devem ser uma lista.');
    salvarModeloBim(db,work.id,{nome:file.name,arquivoNome:file.name,arquivoHash:hash(text),arquivoBase64:await base64(file),disciplina:discipline,elementos});
    setMessage('Modelo vinculado à obra salvo.');
  });
  const analyze=()=>execute(async()=>{
    if(!work||!left||!right||left===right)throw Error('Selecione dois modelos diferentes.');
    const pair=[models.find((m:any)=>m.id===left),models.find((m:any)=>m.id===right)];
    if(pair.some((x:any)=>!x))throw Error('Modelos não encontrados.');
    const result=await executarAnaliseBim(pair,{
      analisarIfc:runtime()?.clashBase64,
      analisarManifestos:([a,z]:any[])=>detectarConflitosBim(criarModeloBim(a),criarModeloBim(z),{modo:'intersection',afastamento:.05}),
      opcoes:{mode:'intersection',tolerance:.002,clearance:.05}
    });
    salvarAnaliseBim(db,work.id,{modeloAId:pair[0].id,modeloBId:pair[1].id,modo:'intersection',afastamento:.05,conflitos:result.conflitos,status:result.status});
    setMessage('Análise '+result.formato+': '+result.conflitos.length+' conflitos.');
  });
  const viewer=()=>execute(async()=>{
    if(!work||!models.length)throw Error('Importe um modelo para gerar o viewer.');
    if(models.some((m:any)=>formatoModeloBim(m)==='ifc')){
      if(!models.every((m:any)=>formatoModeloBim(m)==='ifc'&&m.arquivo_base64))throw Error('Modelos mistos ou IFC sem arquivo original.');
      if(!runtime()?.generateViewerBase64)throw Error('Viewer IFC real exige motor desktop.');
      const result=await runtime().generateViewerBase64(models.map((m:any)=>({name:m.arquivo_nome||m.nome,base64:m.arquivo_base64})));
      if(!result?.output)throw Error('O motor não confirmou o viewer.');
    }else{
      if(!models.every((m:any)=>m.elementos?.length))throw Error('Manifesto sem elementos geométricos.');
      download('viewer-bim-'+work.codigo+'.html',gerarViewerFederadoHtml(criarManifestoViewer(models,all)),'text/html');
    }
    setMessage('Visualizador gerado.');
  });
  const setStatus=(a:string,idx:number,status:string)=>{
    try{atualizarConflitoBim(db,a,idx,status);onChange();setMessage('Status atualizado.');}
    catch(e:any){setMessage(e.message);}
  };
  const createIssue=(a:string,idx:number)=>{
    if(!work)return;
    try{
      salvarPendencia(db,work.id,{descricao:'Conflito BIM #'+idx+' da análise '+a,prioridade:'alta',origem:'bim'});
      onChange();setMessage('Pendência registrada na obra.');
    }catch(e:any){setMessage(e.message);}
  };
  const exportClashes=(type:'json'|'csv')=>{
    if(!work)return;
    if(type==='json'){download('conflitos-'+work.codigo+'.json',JSON.stringify(all,null,2),'application/json');return;}
    const header=['indice','aGlobalId','bGlobalId','aClasse','bClasse','status'];
    const text=[header.join(';'),...all.map((c:any)=>header.map(k=>'"'+String(c[k]||'').replaceAll('"','""')+'"').join(';'))].join('\n');
    download('conflitos-'+work.codigo+'.csv',text,'text/csv;charset=utf-8');
  };
  if(!work)return null;
  return <section className="cbim-react-panel" aria-label="BIM vinculado à obra">
    <h2>BIM da obra · {work.nome}</h2>
    <p>Projetos BIM registrados diretamente na obra existente, preservados sem migração ou duplicação.</p>
    <div className="cbim-react-form-grid">
      <label>Disciplina<select value={discipline} onChange={e=>setDiscipline(e.target.value)}>{['hydraulic','structure','architecture','fire'].map(d=><option key={d} value={d}>{d}</option>)}</select></label>
      <label>Importar IFC / JSON<input type="file" accept=".ifc,.json" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]||null);e.target.value='';}}/></label>
    </div>
    <h3>Modelos locais ({models.length})</h3>{models.map((m:any)=><p key={m.id}>{m.nome} · {m.disciplina} · revisão {m.revisao} · {m.elementos?.length||0} elementos</p>)}
    {models.length>=2&&<div className="cbim-react-form-grid">
      <label>Modelo A<select value={left} onChange={e=>setModelA(e.target.value)}>{models.map((m:any)=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
      <label>Modelo B<select value={right} onChange={e=>setModelB(e.target.value)}>{models.map((m:any)=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
    </div>}
    <div className="cbim-react-toolbar"><button disabled={busy||models.length<2} onClick={analyze}>Analisar modelos</button><button disabled={busy||!models.length} onClick={viewer}>Viewer BIM</button><button onClick={()=>exportClashes('csv')} disabled={!all.length}>Exportar CSV</button><button onClick={()=>exportClashes('json')} disabled={!all.length}>Exportar JSON</button></div>
    {analyses.length>0&&!['concluida_ifc','concluida_manifesto'].includes(analyses[0].status)&&<p>Análise anterior sem motor identificado: reprocesse antes de concluir.</p>}
    <h3>Conflitos ({all.length})</h3><div className="cbim-react-toolbar">
      <label>Estado<select value={filter} onChange={e=>setFilter(e.target.value)}>{['todos','aberto','resolvido','ignorado'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label>Buscar classe / elemento<input value={search} onChange={e=>setSearch(e.target.value)}/></label>
    </div>
    {rows.map((c:any)=><article key={c.analiseId+'-'+c.indice}>
      <b>#{c.indice} · {c.aGlobalId||'A'} × {c.bGlobalId||'B'}</b><p>{c.aClasse} / {c.bClasse} · {c.status||'aberto'}</p>
      <div className="cbim-react-toolbar"><button onClick={()=>setStatus(c.analiseId,c.indice,'resolvido')}>Resolver</button><button onClick={()=>setStatus(c.analiseId,c.indice,'ignorado')}>Ignorar</button><button onClick={()=>setStatus(c.analiseId,c.indice,'aberto')}>Reabrir</button><button onClick={()=>createIssue(c.analiseId,c.indice)}>Criar pendência</button></div>
    </article>)}
    {message&&<p role="status">{message}</p>}
    {busy&&<p aria-busy="true">Processando BIM…</p>}
  </section>;
}
