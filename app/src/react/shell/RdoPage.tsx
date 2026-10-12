
import React from 'react';
import {RdoFieldRows} from './RdoFieldRows';
import {SectionHeading} from '../components/ui';
import {createRdoDraft,readRdoDraft,prepareRdoPayload,duplicateRdoContext} from '../../../../src/domain/rdoEditor.js';
import {filterScopedRecords} from '../../../../src/domain/workspaceScope.js';
import {filterRdosByCompetence,resolveSourceRecord} from '../../../../src/domain/engineeringJourney.js';
import {buscarObra,salvarRdo,atualizarRdo,aprovarRdo,excluirRdo,listarMedicoes} from '../../../../storage/sqliteStore.js';
import {gerarPdfRelatorioComFotos} from '../../pdfTemplates.js';
import {validarFotosRdo,resumoEvidenciasRdo} from '../../../../src/domain/rdoEvidence.js';

const printable=(v:any)=>String(v||'');
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
const localToday=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
async function makePhotos(files:FileList|null) {
  const photos=[];
  for(const f of Array.from(files||[])){
    if(!['image/jpeg','image/png','image/webp'].includes(f.type))throw Error('Fotos devem ser JPEG, PNG ou WebP.');
    if(!f.size||f.size>4*1024*1024)throw Error('Cada foto deve ter até 4 MiB.');
    const bytes=new Uint8Array(await f.arrayBuffer());
    let bin='';for(let i=0;i<bytes.length;i+=32768)bin+=String.fromCharCode(...bytes.subarray(i,i+32768));
    photos.push({uri:'data:'+f.type+';base64,'+btoa(bin),legenda:f.name});
  }
  return validarFotosRdo(photos);
}
export function RdoPage({db,obraId,scope={},onChange,target,onNavigate}:{db:any;obraId:string|null;scope?:any;onChange:()=>void;target?:any;onNavigate?:(route:string,target?:any)=>void}){
  const [editing,setEditing]=React.useState<string|null>(null);
  const [form,setForm]=React.useState<any>(()=>createRdoDraft(localToday()));
  const [error,setError]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [approver,setApprover]=React.useState('');
  const work=obraId?buscarObra(db,obraId):null;
  const rdos=filterScopedRecords(work?.rdos||[],{periodo:scope.periodo||{}},{dateField:'data'});
  const contextualRdos=target?.kind==='rdo-competencia'?filterRdosByCompetence(work?.rdos||[],target.period):[];
  const focusedRdo=target?.kind==='rdo'?resolveSourceRecord(work?.rdos||[],rdos,target.id):{record:null,outsideScope:false};
  const showRdos=target?.kind==='rdo-competencia'?contextualRdos:(focusedRdo.outsideScope?[focusedRdo.record,...rdos]:rdos);
  const relatedMeasures=target?.kind==='rdo-competencia'&&obraId?listarMedicoes(db,obraId).filter((m:any)=>m.periodo===target.period):[];
  const createDate=()=>scope.periodo?.fim||scope.periodo?.inicio||localToday();
  const choose=(r:any|null)=>{setEditing(r?.id||'new');setForm(r?readRdoDraft(r):createRdoDraft(createDate()));setError('');};
  const useLast=(r:any)=>{setEditing('new');setForm(duplicateRdoContext(r,createDate()));setError('');};
  const rectify=(r:any)=>{const next=duplicateRdoContext(r,createDate());next.observacoes='Retificação referente ao RDO '+r.id+' de '+r.data+'. ';setEditing('new');setForm(next);setError('');};

  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!work||busy)return;setBusy(true);
    const old=work.rdos.find((r:any)=>r.id===editing);
    try{
      if(old?.status_aprovacao==='aprovado')throw Error('RDO aprovado não pode ser editado. Crie um RDO de retificação, referenciando o original nas observações.');
      const photos=await makePhotos(e.currentTarget.querySelector('input[type=file]')?.files||null);
      const payload=prepareRdoPayload(form,old);
      payload.fotos=[...payload.fotos,...photos];
      if(old)atualizarRdo(db,old.id,payload);
      else salvarRdo(db,work.id,payload);
      setEditing(null);onChange();setError('');
    }catch(err:any){setError(err.message);}finally{setBusy(false);}
  };
  const change=(key:string,value:string)=>setForm((f:any)=>({...f,[key]:value}));
  const changeRows=(key:string,values:any[])=>setForm((f:any)=>({...f,[key]:values}));
  const approval=(r:any)=>{
    try{aprovarRdo(db,r.id,approver);setApprover('');onChange();setError('');}catch(e:any){setError(e.message);}
  };
  const remove=(r:any)=>{
    const confirmed=window.prompt('Para excluir definitivamente o RDO de '+r.data+', digite EXCLUIR:');
    if(confirmed!=='EXCLUIR')return;
    try{excluirRdo(db,r.id,confirmed);onChange();}catch(e:any){setError(e.message);}
  };
  const pdf=async(r:any)=>{
    if(!work)return;
    try{
      setError('');
      const annexes=[];
      for(const [index,photo] of (r.fotos||[]).entries()){
        if(!String(photo.uri||'').startsWith('data:image/'))continue;
        const image=new Image();image.src=photo.uri;await image.decode();
        const ratio=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
        canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
        const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas indisponível para anexar fotos.');
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const encoded=canvas.toDataURL('image/jpeg',0.79).split(',')[1];
        annexes.push({jpeg:Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),
          width:canvas.width,height:canvas.height,
          caption:'Foto '+(index+1)+' · '+(photo.legenda||'Sem legenda')+' · '+(photo.local||'Sem local')});
      }
      download(gerarPdfRelatorioComFotos('RDO - '+work.nome,{
      Identificação:['Obra: '+work.codigo,'Data: '+r.data,'Responsável: '+r.responsavel,'Status: '+r.status_aprovacao],
      Clima:[r.clima?.condicao||'-'],
      Equipes:(r.equipes||[]).map((x:any)=>x.funcao+': '+x.quantidade),
      Serviços:(r.servicosExecutados||[]).map((x:any)=>x.descricao),
      Materiais:(r.materiaisRecebidos||[]).map((x:any)=>x.material+': '+x.quantidade+' '+x.unidade),
      Ocorrências:(r.ocorrencias||[]).map((x:any)=>x.descricao),
      Impedimentos:(r.impedimentos||[]).map((x:any)=>x.descricao),
      Observações:[r.observacoes||'-'],
      'Evidências fotográficas':(r.fotos||[]).map((p:any,i:number)=>'Foto '+(i+1)+' · '+(p.legenda||'Sem legenda')+' · '+(p.local||'Local não informado')+' · original preservado no banco local; fotos locais anexas nas páginas seguintes'),
      Aprovação:['Aprovado por: '+(r.aprovado_por||'pendente'),'Assinatura: _________________________']
    },annexes),'RDO-'+work.codigo+'-'+r.data+'.pdf');
    }catch(e:any){setError('Falha ao gerar PDF com imagens: '+(e.message||String(e)));}
  };
  if(!work)return <section className="cbim-react-section"><h1>Diário de obra</h1><p>Selecione uma obra para consultar e registrar RDOs.</p></section>;
  return <section className="cbim-react-section"><h1>RDO · {work.nome}</h1><p>Diário completo, fotos, aprovação e PDF usando os mesmos dados persistidos na aplicação anterior.</p>
    {(scope.periodo?.inicio||scope.periodo?.fim)&&<p className="studio-muted">Exibindo somente RDOs dentro do período selecionado. Um novo registro fora desse período ficará salvo, mas não aparecerá nesta lista.</p>}
    {scope.frenteId&&<p role="status" className="cbim-react-panel">RDOs existentes não possuem vínculo canônico com frente; a seleção de frente não filtra esses registros. O filtro de datas continua aplicado.</p>}
    {target?.kind==='rdo-competencia'&&<div className="cbim-react-panel cbim-journey-focus" role="status">
     <h2>Evidências da competência {target.period}</h2>
     <p>{contextualRdos.length} RDO(s) na competência. Esta relação é somente temporal: o sistema não presume vínculo entre o serviço descrito, o GUID IFC e a medição.</p>
     <h3>Medições operacionais da mesma competência</h3>
     {relatedMeasures.map((m:any)=><article key={m.id}><b>{m.descricao}</b> · {m.status} · {m.quantidade} {m.unidade}
      {onNavigate&&<button type="button" onClick={()=>onNavigate('Operação',{kind:'medicao',id:m.id,obraId,studyId:target.studyId,period:m.periodo})}>Abrir medição de origem</button>}</article>)}
     {!relatedMeasures.length&&<p>Nenhuma medição operacional cadastrada para esta competência.</p>}
    </div>}
    {target?.kind==='rdo'&&!focusedRdo.record&&<p role="alert">RDO de origem {target.id} não encontrado nesta obra. A referência não foi alterada.</p>}
    {focusedRdo.outsideScope&&<p role="status">RDO de origem fora do filtro de datas; exibido somente para conferência, sem alterar o recorte existente.</p>}
    <p className="studio-muted">A aprovação é imutável. Um RDO aprovado só pode ser retificado mediante novo registro; fotos e histórico são preservados no SQLite. O PDF anexa as evidências locais.</p>
    <div className="cbim-react-toolbar"><button onClick={()=>choose(null)}>+ Novo RDO completo</button>{work.rdos?.length>0&&<button type="button" onClick={()=>useLast(work.rdos[0])}>Novo com equipe do último dia</button>}</div>
    {error&&<p role="alert" className="cbim-react-error">{error}</p>}
    {editing&&<form className="cbim-react-panel" onSubmit={e=>{void submit(e);}}>
      <SectionHeading title={editing==='new'?'Novo RDO':'Corrigir RDO'} description="Preencha campos separados; nenhuma lista precisa de ponto e vírgula. O registro existente permanece rascunho até a aprovação."/>
      <div className="cbim-rdo-editor-meta">
        <label>Data<input aria-label="Data do RDO" type="date" required value={form.data} onChange={e=>change('data',e.target.value)}/></label>
        <label>Turno<input aria-label="Turno" value={form.turno} onChange={e=>change('turno',e.target.value)}/></label>
        <label>Responsável<input aria-label="Responsável" value={form.responsavel} required onChange={e=>change('responsavel',e.target.value)}/></label>
        <label>Clima<input aria-label="Clima" value={form.clima} onChange={e=>change('clima',e.target.value)}/></label>
      </div>
      {(['equipes','servicos','materiais','ocorrencias','impedimentos'] as const).map(kind=>
       <RdoFieldRows key={kind} kind={kind} values={form[kind]||[]} onChange={values=>changeRows(kind,values)}/>)}
      <div className="cbim-react-form-grid">
        <label>Observações<textarea aria-label="Observações" rows={3} value={form.observacoes} onChange={e=>change('observacoes',e.target.value)}/></label>
        <label>Evidências fotográficas (até 4 MiB por imagem)<input aria-label="Fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple/></label>
      </div>
      <div className="cbim-react-toolbar cbim-rdo-actions"><button type="submit" disabled={busy}>{busy?'Salvando…':'Salvar RDO'}</button><button type="button" onClick={()=>setEditing(null)}>Cancelar</button></div>
    </form>}
    <div className="cbim-react-panel"><h2>Registros ({showRdos.length})</h2>
      {showRdos.map((r:any)=><article key={r.id} className={target?.kind==='rdo'&&target.id===r.id?'cbim-journey-focus':''}><b>{r.data} · {r.responsavel}</b><p>{r.status_aprovacao||'rascunho'} · {r.servicosExecutados?.length||0} serviços · {r.fotos?.length||0} fotos</p>
       {(r.fotos||[]).length>0&&<details><summary>Ver evidências fotográficas ({r.fotos.length})</summary><div className="cbim-react-card-grid">{r.fotos.map((p:any,i:number)=><figure key={i}>{String(p.uri||'').startsWith('data:image/')?<img alt={p.legenda||'Foto de campo '+(i+1)} src={p.uri} loading="lazy" style={{width:'100%',maxHeight:220,objectFit:'contain'}}/>:<p>Foto externa antiga: {p.uri}</p>}<figcaption>{p.legenda||'Sem legenda'} · {p.local||'Sem local'}</figcaption></figure>)}</div></details>}
        <div className="cbim-react-toolbar">
          {onNavigate&&<button type="button" onClick={()=>onNavigate('Financeiro',{kind:'contas-competencia',period:String(r.data).slice(0,7),obraId,studyId:target?.studyId||''})}>Contas da competência (vencimento)</button>}
          {r.status_aprovacao!=='aprovado'&&<button onClick={()=>choose(r)}>Editar</button>}{r.status_aprovacao==='aprovado'&&<button type="button" onClick={()=>rectify(r)}>Criar retificação</button>}<button onClick={()=>{void pdf(r);}}>PDF com fotos</button>{r.status_aprovacao!=='aprovado'&&<button onClick={()=>remove(r)}>Excluir</button>}
          {r.status_aprovacao!=='aprovado'&&<><label>Nome do aprovador<input value={approver} onChange={e=>setApprover(e.target.value)}/></label><button disabled={!approver.trim()} onClick={()=>approval(r)}>Aprovar</button></>}</div>
      </article>)}
      {!showRdos.length&&<p>Nenhum RDO cadastrado para o contexto solicitado.</p>}
    </div>
  </section>;
}
