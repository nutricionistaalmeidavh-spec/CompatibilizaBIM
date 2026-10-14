
import React from 'react';
import {ModuleHero,ModuleKpis} from './EngineeringModuleLayout';
import {
  listarModelosEstruturais,buscarModeloEstrutural,salvarModeloEstrutural,
  salvarPavimentoEstrutural,salvarNoEstrutural,salvarElementoEstrutural,salvarCargaEstrutural
} from '../../../../storage/sqliteStore.js';
import {validarModeloEstrutural} from '../../../../src/domain/structuralModel.js';
import {analisarModeloEstruturalPlano,analisarModeloEstruturalEspacial} from '../../../../src/analysis/structuralModelAdapter.js';
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
  const [action,setAction]=React.useState<'modelo'|'pavimento'|'no'|'elemento'|'carga'|''>('');
  const [analysis,setAnalysis]=React.useState<any>(null);
  const [loadCase,setLoadCase]=React.useState<'permanente'|'variavel'|'acidental'>('permanente');
  const [loadType,setLoadType]=React.useState<'distribuida'|'concentrada'|'momento'>('distribuida');
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
      if(action==='no')salvarNoEstrutural(db,id,{nome:str(d,'nome'),x:num(d,'x'),y:num(d,'y'),z:num(d,'z'),supports:{ux:d.has('ux'),uy:d.has('uy'),uz:d.has('uz'),rx:d.has('rx'),ry:d.has('ry'),rz:d.has('rz')},loads:{fx:num(d,'fx'),fy:num(d,'fy'),fz:num(d,'fz'),mx:num(d,'mx'),my:num(d,'my'),mz:num(d,'mz')}});
      if(action==='elemento')salvarElementoEstrutural(db,id,{nome:str(d,'nome'),tipo:str(d,'tipo'),geometria:{nodeI:str(d,'nodeI'),nodeJ:str(d,'nodeJ')},material:{E:num(d,'e')},secao:{A:num(d,'a'),I:num(d,'i')}});
      if(action==='carga')salvarCargaEstrutural(db,id,{elementoId:str(d,'elementoId')||null,tipo:str(d,'tipo'),descricao:str(d,'descricao'),valor:num(d,'valor'),unidade:str(d,'unidade'),combinacao:str(d,'combinacao')});
    });
  };
  const compute=(mode:'2d'|'3d')=>{
    if(!model)return;
    try{const result=mode==='2d'?analisarModeloEstruturalPlano(model,{loadCase}):analisarModeloEstruturalEspacial(model,{loadCase});setAnalysis({mode,result});setError('');}
    catch(e:any){setError(e.message);setAnalysis(null);}
  };
  const viewer=()=>{
    if(!model)return;
    try{download(gerarViewerFederadoHtml(criarManifestoEstruturalViewer(model)),'viewer-estrutural-'+model.id+'.html','text/html');setError('');}
    catch(e:any){setError(e.message);}
  };
  if(!obraId)return <section className="cbim-react-section"><h1>Modelo estrutural</h1><p>Selecione uma obra para criar ou abrir um modelo estrutural.</p></section>;
  return <section className="cbim-react-section cbim-p5-module cbim-p5-structural" data-testid="cbim-p5-structural">
    <ModuleHero area="ENGENHARIA / MODELOS ESTRUTURAIS" title="Estruturas · modelos globais"
      description="Modelagem por nós e barras, cargas verificáveis e análises 2D/3D. Visualizações não substituem dimensionamento normativo."
      meta={model?'Modelo ativo · '+model.nome+' · '+model.unidade:models.length+' modelo(s) na obra'}/>
    <ModuleKpis items={[
      {label:'Modelos da obra',value:models.length,source:'Cadastros do SQLite'},
      {label:'Pavimentos',value:model?.pavimentos?.length||0,source:model?'Modelo selecionado':'Selecione um modelo',tone:'purple'},
      {label:'Nós / barras',value:(model?.nos?.length||0)+' / '+(model?.elementos?.length||0),source:'Entidades reais do modelo',tone:'green'},
      {label:'Cargas registradas',value:model?.cargas?.length||0,source:'Casos de carga persistidos',tone:'amber'},
    ]}/>
    <div className="cbim-react-toolbar"><label>Modelo<select value={id} onChange={e=>{setSelected(e.target.value);setAnalysis(null);}}><option value="">Selecione</option>{models.map((m:any)=><option key={m.id} value={m.id}>{m.nome} · v{m.versao}</option>)}</select></label><button onClick={()=>setAction('modelo')}>+ Novo modelo</button>
      {model&&<><button onClick={()=>setAction('pavimento')}>+ Pavimento</button><button onClick={()=>setAction('no')}>+ Nó</button><button onClick={()=>setAction('elemento')}>+ Elemento</button><button onClick={()=>setAction('carga')}>+ Carga</button><label>Caso de carga<select value={loadCase} onChange={e=>{setLoadCase(e.target.value as any);setAnalysis(null);}}><option value="permanente">Permanente</option><option value="variavel">Variável</option><option value="acidental">Acidental</option></select></label><button onClick={()=>compute('2d')}>Analisar 2D</button><button onClick={()=>compute('3d')}>Analisar 3D</button><button onClick={viewer}>Viewer</button></>}
    </div>
    {error&&<p role="alert">{error}</p>}
    {action&&<form className="cbim-react-panel" onSubmit={save}><h2>{({modelo:'Novo modelo',pavimento:'Novo pavimento',no:'Novo nó',elemento:'Nova barra',carga:'Nova carga'} as const)[action]}</h2>
      <div className="cbim-react-form-grid"><label>Nome<input required name="nome"/></label>
      {action==='modelo'&&<><label>Norma<input name="norma" defaultValue="ABNT NBR 6118"/></label><label>Unidade<select name="unidade"><option value="kN-m">kN-m</option><option value="tf-m">tf-m</option></select></label></>}
      {action==='pavimento'&&<><label>Nível<input name="nivel" type="number" step="any" defaultValue={0}/></label><label>Altura<input name="altura" type="number" step="any" defaultValue={3}/></label></>}
      {action==='no'&&<>{(['x','y','z','fx','fy','fz','mx','my','mz'] as const).map(key=><label key={key}>{key.toUpperCase()}<input type="number" name={key} step="any" defaultValue={0}/></label>)}{(['ux','uy','uz','rx','ry','rz'] as const).map(key=><label key={key}><input type="checkbox" name={key}/> Restrição {key.toUpperCase()}</label>)}</>}
      {action==='carga'&&<><label>Descrição<input name="descricao" required/></label>
        <label>Tipo<select name="tipo" value={loadType} onChange={e=>setLoadType(e.target.value as any)}><option value="distribuida">Distribuída</option><option value="concentrada">Concentrada</option><option value="momento">Momento</option></select></label>
        <label>Elemento<select name="elementoId" required defaultValue=""><option value="">Selecione a barra (obrigatório)</option>{model?.elementos?.map((e:any)=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
        <label>Valor<input type="number" name="valor" step="any" required/></label>
        <label>Unidade<input name="unidade" readOnly key={loadType+'-'+model?.unidade} value={(model?.unidade==='tf-m'?'tf':'kN')+(loadType==='distribuida'?'/m':loadType==='momento'?'.m':'')}/></label><p>Convenção: forças e cargas distribuídas atuam no eixo Y global; momentos em Z global. Carga concentrada e momento são aplicados no meio do vão. Informe kN, kN/m ou kN.m conforme o tipo (tf para modelos tf-m).</p>
        <label>Combinação<select name="combinacao"><option value="permanente">Permanente</option><option value="variavel">Variável</option><option value="acidental">Acidental</option></select></label></>}
      {action==='elemento'&&<><label>Tipo<select name="tipo"><option value="viga">Viga</option><option value="pilar">Pilar</option><option value="barra">Barra</option></select></label>
        <label>Nó inicial<select name="nodeI" required>{model?.nos?.map((n:any)=><option key={n.id} value={n.nome}>{n.nome}</option>)}</select></label><label>Nó final<select name="nodeJ" required>{model?.nos?.map((n:any)=><option key={n.id} value={n.nome}>{n.nome}</option>)}</select></label>
        {(['e','a','i'] as const).map(key=><label key={key}>{({e:'E (módulo)',a:'Área',i:'Inércia'} as const)[key]}<input type="number" name={key} step="any" defaultValue={key === 'e' ? 200000000 : (key === 'a' ? 0.02 : 0.00008)}/></label>)}</>}
      </div><div className="cbim-react-toolbar"><button type="submit">Salvar</button><button type="button" onClick={()=>setAction('')}>Cancelar</button></div>
    </form>}
    {model&&<><div className="cbim-react-panel cbim-p5-model-view"><h2>{model.nome} · {model.norma}</h2><p className="studio-muted">Projeção dos nós e barras cadastrados. Não representa deformação calculada nem armaduras dimensionadas.</p><Projection model={model}/></div>

      <div className="cbim-react-panel"><h2>Cargas do modelo</h2>{model.cargas?.length?model.cargas.map((c:any)=><article key={c.id}><b>{c.descricao||c.tipo}</b> · {c.valor} {c.unidade} · {c.combinacao}</article>):<p>Nenhuma carga registrada.</p>}</div>
      {analysis&&<div className="cbim-react-panel"><h2>Análise estrutural {analysis.mode.toUpperCase()} — {analysis.result.loadCase}</h2><p>{analysis.result.appliedLoads.length} carga(s) de barra consideradas neste caso. As cargas nodais legadas pertencem ao caso permanente. Resultados linear-elásticos preliminares; combinações ELU/ELS e verificações normativas exigem avaliação do responsável técnico.</p><pre>{JSON.stringify(analysis.result,null,2)}</pre><button onClick={()=>download(JSON.stringify(analysis.result,null,2),'analise-estrutural-'+analysis.mode+'.json','application/json')}>Exportar relatório JSON</button></div>}
    </>}
  </section>;
}
