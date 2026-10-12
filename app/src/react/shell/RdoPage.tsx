
import React from 'react';
import {buscarObra,salvarRdo,atualizarRdo,aprovarRdo,excluirRdo} from '../../../../storage/sqliteStore.js';
import {gerarPdfRelatorioComFotos} from '../../pdfTemplates.js';
import {validarFotosRdo,resumoEvidenciasRdo} from '../../../../src/domain/rdoEvidence.js';

const rows=(v:string)=>v.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const printable=(v:any)=>String(v||'');
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
const initial={data:new Date().toISOString().slice(0,10),turno:'Diurno',responsavel:'',clima:'',equipes:'',servicos:'',materiais:'',ocorrencias:'',impedimentos:'',observacoes:''};
type Values=typeof initial;
function readValues(r:any):Values{
  return {
    data:printable(r.data),turno:printable(r.turno),responsavel:printable(r.responsavel),
    clima:printable(r.clima?.condicao),
    equipes:(r.equipes||[]).map((e:any)=>e.funcao+';'+e.quantidade).join('\n'),
    servicos:(r.servicosExecutados||[]).map((x:any)=>x.descricao).join('\n'),
    materiais:(r.materiaisRecebidos||[]).map((e:any)=>e.material+';'+e.quantidade+';'+e.unidade).join('\n'),
    ocorrencias:(r.ocorrencias||[]).map((e:any)=>e.descricao).join('\n'),
    impedimentos:(r.impedimentos||[]).map((e:any)=>e.descricao).join('\n'),
    observacoes:printable(r.observacoes)
  };
}
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
export function RdoPage({db,obraId,onChange}:{db:any;obraId:string|null;onChange:()=>void}){
  const [editing,setEditing]=React.useState<string|null>(null);
  const [form,setForm]=React.useState<Values>(initial);
  const [error,setError]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [approver,setApprover]=React.useState('');
  const work=obraId?buscarObra(db,obraId):null;
  const rdos=work?.rdos||[];
  const choose=(r:any|null)=>{setEditing(r?.id||'new');setForm(r?readValues(r):{...initial});setError('');};
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!work||busy)return;setBusy(true);
    const old=rdos.find((r:any)=>r.id===editing);
    try{
      if(old?.status_aprovacao==='aprovado')throw Error('RDO aprovado não pode ser editado. Crie um RDO de retificação, referenciando o original nas observações.');
      const photos=await makePhotos(e.currentTarget.querySelector('input[type=file]')?.files||null);
      const payload={
        data:form.data,turno:form.turno,responsavel:form.responsavel,
        clima:{condicao:form.clima},
        equipes:rows(form.equipes).map(l=>{const[a,b]=l.split(';');return{funcao:a,quantidade:Number(b||0)}}),
        servicosExecutados:rows(form.servicos).map(descricao=>({descricao})),
        materiaisRecebidos:rows(form.materiais).map(l=>{const[a,b,c]=l.split(';');return{material:a,quantidade:Number(b||0),unidade:c||''}}),
        ocorrencias:rows(form.ocorrencias).map(descricao=>({descricao})),
        impedimentos:rows(form.impedimentos).map(descricao=>({descricao,resolvido:false})),
        observacoes:form.observacoes,
        fotos:[...(old?.fotos||[]),...photos]
      };
      if(old)atualizarRdo(db,old.id,payload);
      else salvarRdo(db,work.id,payload);
      setEditing(null);onChange();setError('');
    }catch(err:any){setError(err.message);}finally{setBusy(false);}
  };
  const change=(key:keyof Values,value:string)=>setForm(f=>({...f,[key]:value}));
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
    <p className="studio-muted">A aprovação é imutável. Retificações devem ser registradas em novo RDO; as fotos permanecem no SQLite local. O PDF inclui as fotografias locais em páginas anexas, além do índice de evidências. Fotos externas antigas permanecem apenas referenciadas.</p><button onClick={()=>choose(null)}>+ Novo RDO completo</button>{error&&<p role="alert">{error}</p>}
    {editing&&<form className="cbim-react-panel" onSubmit={e=>{void submit(e);}}>
      <h2>{editing==='new'?'Novo RDO':'Corrigir RDO'}</h2>
      <div className="cbim-react-form-grid">
        {(['data','turno','responsavel','clima'] as const).map(key=><label key={key}>{({data:'Data',turno:'Turno',responsavel:'Responsável',clima:'Clima'} as const)[key]}<input type={key==='data'?'date':'text'} required={key==='data'||key==='responsavel'} value={form[key]} onChange={e=>change(key,e.target.value)}/></label>)}
        {(['equipes','servicos','materiais','ocorrencias','impedimentos','observacoes'] as const).map(key=><label key={key}>{({equipes:'Equipes (função;quantidade)',servicos:'Serviços executados',materiais:'Materiais (nome;quantidade;unidade)',ocorrencias:'Ocorrências',impedimentos:'Impedimentos',observacoes:'Observações'} as const)[key]}<textarea rows={4} required={key==='servicos'} value={form[key]} onChange={e=>change(key,e.target.value)}/></label>)}
        <label>Fotos<input type="file" accept="image/*" multiple/></label>
      </div><div className="cbim-react-toolbar"><button type="submit" disabled={busy}>{busy?'Salvando…':'Salvar RDO'}</button><button type="button" onClick={()=>setEditing(null)}>Cancelar</button></div>
    </form>}
    <div className="cbim-react-panel"><h2>Registros ({rdos.length})</h2>
      {rdos.map((r:any)=><article key={r.id}><b>{r.data} · {r.responsavel}</b><p>{r.status_aprovacao||'rascunho'} · {r.servicosExecutados?.length||0} serviços · {r.fotos?.length||0} fotos</p>
       {(r.fotos||[]).length>0&&<details><summary>Ver evidências fotográficas ({r.fotos.length})</summary><div className="cbim-react-card-grid">{r.fotos.map((p:any,i:number)=><figure key={i}>{String(p.uri||'').startsWith('data:image/')?<img alt={p.legenda||'Foto de campo '+(i+1)} src={p.uri} loading="lazy" style={{width:'100%',maxHeight:220,objectFit:'contain'}}/>:<p>Foto externa antiga: {p.uri}</p>}<figcaption>{p.legenda||'Sem legenda'} · {p.local||'Sem local'}</figcaption></figure>)}</div></details>}
        <div className="cbim-react-toolbar">{r.status_aprovacao!=='aprovado'&&<button onClick={()=>choose(r)}>Editar</button>}<button onClick={()=>{void pdf(r);}}>PDF com fotos</button>{r.status_aprovacao!=='aprovado'&&<button onClick={()=>remove(r)}>Excluir</button>}
          {r.status_aprovacao!=='aprovado'&&<><label>Nome do aprovador<input value={approver} onChange={e=>setApprover(e.target.value)}/></label><button disabled={!approver.trim()} onClick={()=>approval(r)}>Aprovar</button></>}</div>
      </article>)}
      {!rdos.length&&<p>Nenhum RDO cadastrado.</p>}
    </div>
  </section>;
}
