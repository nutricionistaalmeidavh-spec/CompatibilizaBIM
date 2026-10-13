import React from 'react';
import {EngineeringTable,EngineeringFeedback} from '../components/EngineeringUI';
import {previewScheduleImport} from '../../../../src/bim/scheduleImportPreview.js';
type Preview={raw:string;filename:string;validation:ReturnType<typeof previewScheduleImport>};
export function SchedulePreview({busy,onImport,existingIds=[]}:{busy:boolean;existingIds?:string[];onImport:(raw:string)=>Promise<any>}){
 const [preview,setPreview]=React.useState<Preview|null>(null),[error,setError]=React.useState('');
 const choose=async(file:File|null)=>{
  setPreview(null);setError('');if(!file)return;
  try{
   if(file.size>2_000_000)throw Error('CSV maior que 2 MB.');
   const raw=await file.text();setPreview({raw,filename:file.name,validation:previewScheduleImport(raw)});
  }catch(e:any){setError(e.message||String(e));}
 };
 const commit=async()=>{
  if(!preview?.validation.ok||busy)return;
  try{await onImport(preview.raw);setPreview(null);setError('');}catch(e:any){setError(e.message||String(e));}
 };
 const duplicates=preview?.validation.rows.filter(row=>existingIds.includes(row.activity_id)).map(x=>x.activity_id)||[];
 return <section aria-label="Prévia da importação 4D">
  <label>Importar CSV (activity_id, name, start_date, end_date, predecessors)
   <input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{void choose(e.target.files?.[0]||null);e.target.value='';}}/>
  </label>
  {error&&<EngineeringFeedback tone="danger" title="CSV não importado">{error}</EngineeringFeedback>}
  {preview&&<div className="cbim-react-panel"><h4>Conferir antes de importar · {preview.filename}</h4>
   <p>{preview.validation.count} atividade(s). A prévia não altera o cronograma.</p>
   {!!preview.validation.errors.length&&<EngineeringFeedback tone="danger" title="Corrija o CSV">{preview.validation.errors.slice(0,8).join(' · ')}</EngineeringFeedback>}
   {!!duplicates.length&&<EngineeringFeedback tone="warning" title="Códigos existentes">O motor canônico ignora atividades existentes: {duplicates.slice(0,10).join(', ')}.</EngineeringFeedback>}
   <EngineeringTable label="Prévia das atividades" rows={preview.validation.rows} rowKey={r=>r.activity_id} empty="Nenhuma atividade." columns={[
     {key:'id',header:'Código',cell:r=>r.activity_id},
     {key:'name',header:'Nome',cell:r=>r.name},
     {key:'start',header:'Início',cell:r=>r.start_date},
     {key:'end',header:'Fim',cell:r=>r.end_date},
     {key:'preds',header:'Predecessoras',cell:r=>r.predecessors.join(', ')||'—'}
   ]}/>
   {preview.validation.count>30&&<p role="status">Primeiras 30 atividades; Python validará o arquivo inteiro.</p>}
   <div className="cbim-react-toolbar">
    <button type="button" disabled={!preview.validation.ok||busy} onClick={()=>void commit()}>Confirmar importação do cronograma</button>
    <button type="button" disabled={busy} onClick={()=>setPreview(null)}>Descartar prévia</button>
   </div>
  </div>}
 </section>;
}
