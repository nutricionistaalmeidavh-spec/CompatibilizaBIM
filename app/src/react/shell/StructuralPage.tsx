
import React from 'react';
import {
  listarModelosEstruturais,buscarModeloEstrutural,salvarModeloEstrutural,
  salvarPavimentoEstrutural,salvarNoEstrutural,salvarElementoEstrutural
} from '../../../../storage/sqliteStore.js';
import {validarModeloEstrutural} from '../../../../src/domain/structuralModel.js';
import {analisarModeloEstruturalPlano} from '../../../../src/analysis/structuralModelAdapter.js';
import {analisarPorticoEspacial3D} from '../../../../src/analysis/portal3d.js';
import {criarManifestoEstruturalViewer} from '../../../../src/bim/structuralViewerAdapter.js';
import {gerarViewerFederadoHtml} from '../../../../src/bim/viewer.js';

const num=(d:FormData,k:string)=>Number(d.get(k)||0);
const str=(d:FormData,k:string)=>String(d.get(k)||'');
function download(text:string,name:string,format:string){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type:format}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function Projection({model}:{model:any}){
  const nodes=model.nos||[];
  const positions=nodes.map((n:any)=>({id:n.id,name:n.nome,x:Number(n.x)*.86-Number(n.y)*.5,y:Number(n.x)*.28+Number(n.y)*.4-Number(n.z)*.86}));
  const xs=positions.map((p:any)=>p.x),ys=positions.map((p:any)=>p.y);
  const xmin=Math.min(0,...xs),xmax=Math.max(1,...xs),ymin=Math.min(0,...ys),ymax=Math.max(1,...ys);
  const factor=Math.min(440/(xmax-xmin||1),300/(ymax-ymin||1));
  const point=(p:any)=>({x:40+(p.x-xmin)*factor,y:35+(p.y-ymin)*factor});
  const byName=new Map(positions.map((p:any)=>[p.name,point(p)]));
  return <svg role="img" aria-label="Vista estrutural isométrica de nós e barras" viewBox="0 0 560 400" style={{width:'100%',maxWidth:700,background:'#edf3fa',borderRadius:12}}>
    {model.elementos?.map((e:any)=>{
      const start=byName.get(e.geometria?.nodeI),end=byName.get(e.geometria?.nodeJ);
      if(!start||!end)return null;
      return <line key={e.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#1c5b8e" strokeWidth={4} strokeLinecap="round"/>;
    })}
    {positions.map((p:any)=>{const at=point(p);return <g key={p.id}><circle cx={at.x} cy={at.y} r="5" fill="#dc7d30"/><text x={at.x+8} y={at.y-8} fontSize="12" fill="#173451">{p.name}</text></g>;})}
  </svg>;
}
export function StructuralPage({db,obraId,onChange}:{db:any;obraId:string|null;onChange:()=>void}){
  const [selected,setSelected]=React.useState('');
  const [action,setAction]=React.useState<'modelo'|'pavimento'|'no'|'elemento'|''>('');
  const [analysis,setAnalysis]=React.useState<any>(null);
  const [error,setError]=React.useState('');
  const models=obraId?listarModelosEstruturais(db,obraId):[];
  const id=selected||models[0]?.id||'';
  const model=id?buscarModeloEstrutural(db,id):null;
  const mutate=(fn:()=>void)=>{try{fn();onChange();setError('');setAction('');setAnalysis(null);}catch(e:any){setError(e.message);}};
  const save=(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const d=new FormData(e.currentTarget);
    mutate(()=>{
      if(action==='modelo'){
        const data=validarModeloEstrutural({nome:str(d,'nome'),norma:str(d,'norma'),unidade:str(d,'unidade')});
        const newId=salvarModeloEstrutural(db,obraId,data);setSelected(newId);
      }
      if(action==='pavimento')salvarPavimentoEstrutural(db,id,{nome:str(d,'nome'),nivel:num(d,'nivel'),altura:num(d,'altura')});
      if(action==='no')salvarNoEstrutural(db,id,{nome:str(d,'nome'),x:num(d,'x'),y:num(d,'y'),z:num(d,'z'),supports:{ux:d.has('ux'),uy:d.has('uy'),uz:d.has('uz'),rx:d.has('rx'),ry:d.has('ry'),rz:d.has('rz')},loads:{fx:num(d,'fx'),fy:num(d,'fy'),fz:num(d,'fz')}});
      if(action==='elemento')salvarElementoEstrutural(db,id,{nome:str(d,'nome'),tipo:str(d,'tipo'),geometria:{nodeI:str(d,'nodeI'),nodeJ:str(d,'nodeJ')},material:{E:num(d,'e')},secao:{A:num(d,'a'),I:num(d,'i')}});
    });
  };
  const compute=(mode:'2d'|'3d')=>{
    if(!model)return;
    try{const result=mode==='2d'?analisarModeloEstruturalPlano(model):analisarPorticoEspacial3D(model);setAnalysis({mode,result});setError('');}
    catch(e:any){setError(e.message);setAnalysis(null);}
  };
  const viewer=()=>{
    if(!model)return;
    try{download(gerarViewerFederadoHtml(criarManifestoEstruturalViewer(model)),'viewer-estrutural-'+model.id+'.html','text/html');setError('');}
    catch(e:any){setError(e.message);}
  };
  if(!obraId)return <section className="cbim-react-section"><h1>Modelo estrutural</h1><p>Selecione uma obra para criar ou abrir um modelo estrutural.</p></section>;
  return <section className="cbim-react-section"><h1>Estruturas · modelos globais</h1><p>Os dados, as análises 2D/3D e o manifesto do visualizador usam os mesmos motores e tabelas do produto original.</p>
    <div className="cbim-react-toolbar"><label>Modelo<select value={id} onChange={e=>{setSelected(e.target.value);setAnalysis(null);}}><option value="">Selecione</option>{models.map((m:any)=><option key={m.id} value={m.id}>{m.nome} · v{m.versao}</option>)}</select></label><button onClick={()=>setAction('modelo')}>+ Novo modelo</button>
      {model&&<><button onClick={()=>setAction('pavimento')}>+ Pavimento</button><button onClick={()=>setAction('no')}>+ Nó</button><button onClick={()=>setAction('elemento')}>+ Elemento</button><button onClick={()=>compute('2d')}>Analisar 2D</button><button onClick={()=>compute('3d')}>Analisar 3D</button><button onClick={viewer}>Viewer</button></>}
    </div>
    {error&&<p role="alert">{error}</p>}
    {action&&<form className="cbim-react-panel" onSubmit={save}><h2>{({modelo:'Novo modelo',pavimento:'Novo pavimento',no:'Novo nó',elemento:'Nova barra'} as const)[action]}</h2>
      <div className="cbim-react-form-grid"><label>Nome<input required name="nome"/></label>
      {action==='modelo'&&<><label>Norma<input name="norma" defaultValue="ABNT NBR 6118"/></label><label>Unidade<select name="unidade"><option value="kN-m">kN-m</option><option value="tf-m">tf-m</option></select></label></>}
      {action==='pavimento'&&<><label>Nível<input name="nivel" type="number" step="any" defaultValue={0}/></label><label>Altura<input name="altura" type="number" step="any" defaultValue={3}/></label></>}
      {action==='no'&&<>{(['x','y','z','fx','fy','fz'] as const).map(key=><label key={key}>{key.toUpperCase()}<input type="number" name={key} step="any" defaultValue={0}/></label>)}{(['ux','uy','uz','rx','ry','rz'] as const).map(key=><label key={key}><input type="checkbox" name={key}/> Restrição {key.toUpperCase()}</label>)}</>}
      {action==='elemento'&&<><label>Tipo<select name="tipo"><option value="viga">Viga</option><option value="pilar">Pilar</option><option value="barra">Barra</option></select></label>
        <label>Nó inicial<select name="nodeI" required>{model?.nos?.map((n:any)=><option key={n.id} value={n.nome}>{n.nome}</option>)}</select></label><label>Nó final<select name="nodeJ" required>{model?.nos?.map((n:any)=><option key={n.id} value={n.nome}>{n.nome}</option>)}</select></label>
        {(['e','a','i'] as const).map(key=><label key={key}>{({e:'E (módulo)',a:'Área',i:'Inércia'} as const)[key]}<input type="number" name={key} step="any" defaultValue={key==='e'?200000000:key==='a'?.02:.00008}/></label>)}</>}
      </div><div className="cbim-react-toolbar"><button type="submit">Salvar</button><button type="button" onClick={()=>setAction('')}>Cancelar</button></div>
    </form>}
    {model&&<><div className="cbim-react-panel"><h2>{model.nome} · {model.norma}</h2><Projection model={model}/></div>
      <div className="cbim-react-metrics"><article>{model.pavimentos?.length||0} pavimentos</article><article>{model.nos?.length||0} nós</article><article>{model.elementos?.length||0} elementos</article><article>{model.cargas?.length||0} cargas</article></div>
      {analysis&&<div className="cbim-react-panel"><h2>Análise estrutural {analysis.mode.toUpperCase()}</h2><pre>{JSON.stringify(analysis.result,null,2)}</pre><button onClick={()=>download(JSON.stringify(analysis.result,null,2),'analise-estrutural-'+analysis.mode+'.json','application/json')}>Exportar relatório JSON</button></div>}
    </>}
  </section>;
}
