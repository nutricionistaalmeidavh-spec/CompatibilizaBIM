import React from 'react';
import {EngineeringTable,EngineeringFeedback} from '../components/EngineeringUI';
type Row={guid:string;ifc_class:string;name:string;description:string;object_type:string};
type Result={source:string;read_only:boolean;model_file:string;revision_sha256:string;matched_count:number;rows:Row[];offset:number;limit:number;truncated:boolean};
const classes=['IfcElement','IfcPipeSegment','IfcPipeFitting','IfcDuctSegment','IfcDuctFitting','IfcWall','IfcSlab','IfcBeam','IfcColumn','IfcDoor','IfcWindow','IfcFooting'];
export function IfcQueryPanel({revisions,onQuery}:{revisions:Record<string,string>;onQuery:(params:{file:string;ifc_class:string;text:string;limit:number;offset:number})=>Promise<Result>}){
 const sources=Object.keys(revisions||{});
 const [source,setSource]=React.useState(''),[ifcClass,setIfcClass]=React.useState('IfcElement'),[query,setQuery]=React.useState('');
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[result,setResult]=React.useState<Result|null>(null);
 const selected=sources.includes(source)?source:sources[0]||'';
 React.useEffect(()=>{setResult(null);setError('');},[selected,ifcClass,query]);
 const search=async(offset=0)=>{
  if(!selected)return;setBusy(true);setError('');
  try{
   const next=await onQuery({file:selected,ifc_class:ifcClass,text:query.trim(),offset,limit:50});
   if(!next?.read_only||next.source!=='ifcopenshell_real'||next.revision_sha256!==revisions[selected])throw Error('Consulta sem proveniência IFC válida.');
   setResult(next);
  }catch(e:any){setResult(null);setError(e.message||String(e));}finally{setBusy(false);}
 };
 return <section className="cbim-react-panel" aria-label="Consulta IFC original"><h3>Consulta IFC (P3) · somente leitura</h3>
  <p className="studio-muted">Pesquisa propriedades básicas diretamente no arquivo IFC validado pelo motor IfcOpenShell local. Não altera quantitativos, custos ou revisão.</p>
  {!sources.length?<p role="status">Extraia QTO de um IFC original antes de consultar elementos.</p>:<>
   <div className="cbim-react-form-grid">
    <label>Fonte IFC validada<select value={selected} onChange={e=>setSource(e.target.value)}>{sources.map(x=><option value={x} key={x}>{x}</option>)}</select></label>
    <label>Classe IFC<select value={ifcClass} onChange={e=>setIfcClass(e.target.value)}>{classes.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Nome, descrição ou GUID<input value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} placeholder="Texto no IFC original"/></label>
   </div>
   <button type="button" disabled={busy} onClick={()=>void search(0)}>{busy?'Consultando…':'Consultar IFC'}</button>
   {busy&&<EngineeringFeedback busy title="Consultando o arquivo IFC">Operação local em andamento.</EngineeringFeedback>}
   {error&&<EngineeringFeedback tone="danger" title="Consulta não concluída">{error}</EngineeringFeedback>}
   {result&&<><p role="status">{result.matched_count} elemento(s) correspondentes · {result.model_file} · SHA-256 {result.revision_sha256.slice(0,12)}… · {result.source}</p>
     <EngineeringTable label="Elementos IFC consultados" rows={result.rows} rowKey={row=>row.guid||row.ifc_class+'-'+row.name} empty="Nenhum elemento encontrado." columns={[
       {key:'guid',header:'GUID',cell:row=>row.guid||'—'},
       {key:'class',header:'Classe IFC',cell:row=>row.ifc_class},
       {key:'name',header:'Nome',cell:row=>row.name||'—'},
       {key:'description',header:'Descrição',cell:row=>row.description||row.object_type||'—'}
     ]}/>
     <div className="cbim-react-toolbar">
      <button type="button" disabled={busy||result.offset===0} onClick={()=>void search(Math.max(0,result.offset-50))}>Anterior</button>
      <span>{result.offset+result.rows.length} de {result.matched_count}</span>
      <button type="button" disabled={busy||!result.truncated||result.offset+50>5000} onClick={()=>void search(result.offset+50)}>Próximos 50</button>
     </div>
    </>}
  </>}
 </section>;
}
