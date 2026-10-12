import React from 'react';
import {
  buscarObra, criarObraPersistida, listarObras, salvarEtapa, salvarPendencia,
  salvarMaterial, salvarDocumento, obterDocumento, listarHistorico, listarFrentes, salvarFrente
} from '../../../../storage/sqliteStore.js';
import { gerarPdfRelatorio } from '../../pdfTemplates.js';

type Props={db:any;obraId:string|null;selectWork:(id:string|null)=>void;onChange:()=>void;onNavigate?:(section:string)=>void};
const money=(n:any)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const escapeName=(s:string)=>s.replace(/[^a-z0-9-_]+/gi,'-').slice(0,90);
const lines=(obj:any, prefix=''):string[]=>Object.entries(obj||{}).flatMap(([k,v])=>
  v&&typeof v==='object'?lines(v,prefix+k+'.'):[prefix+k+': '+String(v??'')]);
function download(name:string, blob:Blob) {
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
}
async function encodeFile(file:File):Promise<string>{
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(binary);
}
export function WorksPage({db,obraId,selectWork,onChange,onNavigate}:Props){
  const [newWork,setNewWork]=React.useState(false);
  const [task,setTask]=React.useState('etapa');
  const [error,setError]=React.useState('');
  const [saving,setSaving]=React.useState(false);
  const works=listarObras(db);
  const work=obraId?buscarObra(db,obraId):null;
  const history=obraId?listarHistorico(db,obraId):[];
  const allPending=works.reduce((s:number,w:any)=>s+Number(w.pendencias_abertas||0),0);
  const allRdos=works.reduce((s:number,w:any)=>s+Number(w.rdos_total||0),0);
  const avgProgress=works.length?works.reduce((s:number,w:any)=>s+Number(w.percentual_concluido||0),0)/works.length:0;
  const materialsCost=work?.materiais?.reduce((s:number,m:any)=>s+Number(m.quantidade_realizada||0)*Number(m.custo_unitario||0),0)||0;
  const perform=(op:()=>void):boolean=>{try{op();setError('');onChange();return true;}catch(e:any){setError(e.message||String(e));return false;}};
  const create=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const d=new FormData(event.currentTarget);
    perform(()=>{
      const id=criarObraPersistida(db,{codigo:String(d.get('codigo')),nome:String(d.get('nome')),cliente:String(d.get('cliente')||''),endereco:String(d.get('endereco')||''),responsavelTecnico:String(d.get('responsavel')||'')});
      selectWork(id);setNewWork(false);
    });
  };
  const add=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!work||saving)return;
    setSaving(true);const form=event.currentTarget;
    const d=new FormData(form);
    try{
      const nome=String(d.get('nome')||'');
      if(task==='etapa')salvarEtapa(db,work.id,{nome,percentualPeso:Number(d.get('peso')||0),responsavel:String(d.get('responsavel')||'')});
      if(task==='pendencia')salvarPendencia(db,work.id,{descricao:nome,responsavel:String(d.get('responsavel')||''),prioridade:String(d.get('prioridade')||'media'),prazo:String(d.get('prazo')||'')||null});
      if(task==='material')salvarMaterial(db,work.id,{material:nome,unidade:String(d.get('unidade')||'un'),quantidadePlanejada:Number(d.get('peso')||0),quantidadeRealizada:Number(d.get('realizada')||0),custoUnitario:Number(d.get('custo')||0)});
      if(task==='frente')salvarFrente(db,work.id,{nome,responsavel:String(d.get('responsavel')||'')});
      if(task==='documento'){
        const file=d.get('arquivo');
        if(!(file instanceof File)||!file.size)throw Error('Selecione um arquivo para anexar.');
        salvarDocumento(db,work.id,{nome:nome||file.name,tipo:file.type||'application/octet-stream',dadosBase64:await encodeFile(file)});
      }
      form.reset();setError('');onChange();
    }catch(e:any){setError(e.message||String(e));}
    finally{setSaving(false);}
  };
  const downloadAttachment=(item:any)=>{
    if(!work)return;
    try{
      const source=obterDocumento(db,work.id,item.id);
      if(!source?.dados_base64)throw Error('Este documento não contém o arquivo original.');
      const binary=atob(source.dados_base64);
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      download(source.nome||'documento',new Blob([bytes],{type:source.tipo||'application/octet-stream'}));
      setError('');
    }catch(e:any){setError(e.message);}
  };
  const exportCalc=(calc:any)=>{
    try{
      const results=calc.resultados||{};
      const file=gerarPdfRelatorio('Memória de cálculo - '+calc.titulo,{
        Identificação:['Obra: '+work.codigo,'Cálculo: '+calc.titulo,'Norma: '+(calc.norma||'não informada')],
        Entradas:lines(calc.entradas),
        Resultados:lines(results),
        Observações:['Pré-dimensionamento sujeito a conferência técnica e normativa.']
      });
      download('memoria-'+escapeName(calc.titulo)+'.pdf',file);
    }catch(e:any){setError(e.message);}
  };
  return <section className="cbim-react-section">
    <h1>Carteira de obras</h1><p>Projetos, documentos, cálculos e histórico registrados no SQLite local canônico.</p>
    <div className="cbim-react-metrics"><article>Obras: {works.length}</article><article>Avanço médio: {avgProgress.toFixed(0)}%</article><article>RDOs: {allRdos}</article><article>Pendências abertas: {allPending}</article></div>
    <div className="cbim-react-toolbar">
      <label>Obra atual<select aria-label="Obra selecionada" value={obraId||''} onChange={e=>selectWork(e.target.value||null)}><option value="">Todas as obras</option>{works.map((w:any)=><option value={w.id} key={w.id}>{w.codigo} · {w.nome}</option>)}</select></label>
      <button onClick={()=>setNewWork(v=>!v)}>{newWork?'Cancelar':'+ Nova obra'}</button>
      {onNavigate&&<><button onClick={()=>onNavigate('Operação')}>Operação</button><button onClick={()=>onNavigate('RDO')}>Diário de obra</button><button onClick={()=>onNavigate('Cálculos')}>Calculadoras</button><button onClick={()=>onNavigate('BIM')}>Compatibilização</button></>}
    </div>
    {error&&<p role="alert">{error}</p>}
    {newWork&&<form className="cbim-react-panel cbim-react-form-grid" onSubmit={create}>
      <label>Código<input name="codigo" required/></label><label>Nome<input name="nome" required/></label><label>Cliente<input name="cliente"/></label><label>Endereço<input name="endereco"/></label><label>Responsável técnico<input name="responsavel"/></label><button type="submit">Criar obra</button>
    </form>}
    <div className="cbim-react-card-grid">{works.map((w:any)=><button key={w.id} className={obraId===w.id?'selected':''} onClick={()=>selectWork(w.id)}><b>{w.nome}</b><small>{w.codigo} · {w.status} · {Math.round(w.percentual_concluido||0)}% concluído</small><small>{w.rdos_total} RDO · {w.pendencias_abertas} pendências</small></button>)}</div>
    {work&&<>
      <div className="cbim-react-metrics"><article>Etapas: {work.etapas?.length||0}</article><article>RDO: {work.rdos?.length||0}</article><article>Pendências abertas: {work.pendencias?.filter((p:any)=>p.status!=='resolvida').length||0}</article><article>Custo dos materiais: {money(materialsCost)}</article></div>
      <div className="cbim-react-panel"><h2>{work.nome} · Obra 360</h2><p>{work.codigo} · {work.responsavel_tecnico||'Sem responsável técnico'} · {work.status}</p></div>
      <form className="cbim-react-panel" onSubmit={e=>{void add(e);}}>
        <h2>Novo registro</h2><div className="cbim-react-form-grid">
          <label>Tipo<select value={task} onChange={e=>setTask(e.target.value)}><option value="etapa">Etapa</option><option value="pendencia">Pendência</option><option value="material">Material</option><option value="frente">Frente de serviço</option><option value="documento">Documento local</option></select></label>
          <label>Nome ou descrição<input name="nome" required={task!=='documento'}/></label>
          {['etapa','pendencia','frente'].includes(task)&&<label>Responsável<input name="responsavel"/></label>}
          {['etapa','material'].includes(task)&&<label>{task==='etapa'?'Peso (%)':'Quantidade planejada'}<input name="peso" type="number" step="any" min="0" defaultValue="0"/></label>}
          {task==='material'&&<><label>Realizada<input name="realizada" type="number" min="0" step="any" defaultValue="0"/></label><label>Unidade<input name="unidade" defaultValue="un"/></label><label>Custo unitário<input name="custo" type="number" min="0" step="any" defaultValue="0"/></label></>}
          {task==='pendencia'&&<><label>Prioridade<select name="prioridade"><option value="media">Média</option><option value="alta">Alta</option><option value="baixa">Baixa</option></select></label><label>Prazo<input name="prazo" type="date"/></label></>}
          {task==='documento'&&<label>Arquivo<input name="arquivo" type="file" required/></label>}
        </div><button type="submit" disabled={saving}>{saving?'Salvando…':'Salvar registro'}</button>
      </form>
      <div className="cbim-react-panel"><h2>Etapas e planejamento</h2>{work.etapas?.length?work.etapas.map((e:any)=><article key={e.id}><b>{e.nome}</b> · {Number(e.percentual_concluido||0).toFixed(0)}% · <small>{e.responsavel||'Sem responsável'}</small></article>):<p>Nenhuma etapa cadastrada.</p>}</div>
      <div className="cbim-react-panel"><h2>Pendências e riscos</h2>{work.pendencias?.length?work.pendencias.map((p:any)=><article key={p.id}><b>{p.descricao}</b> · {p.prioridade} · {p.status} · {p.prazo||'Sem prazo'}</article>):<p>Nenhuma pendência cadastrada.</p>}</div>
      <div className="cbim-react-panel"><h2>Relatórios diários</h2>{work.rdos?.length?work.rdos.slice(0,8).map((r:any)=><article key={r.id}><b>{r.data}</b> · {r.responsavel} · {r.servicosExecutados?.length||0} serviços · {r.fotos?.length||0} fotos</article>):<p>Nenhum relatório diário.</p>}
        {onNavigate&&<button onClick={()=>onNavigate('RDO')}>Abrir RDO completo e PDFs</button>}</div>
      <div className="cbim-react-panel"><h2>Cálculos e memórias</h2>{work.calculos?.length?work.calculos.map((c:any)=><article key={c.id}><b>{c.titulo}</b> · {c.norma||'Norma não informada'} <button onClick={()=>exportCalc(c)}>Exportar PDF</button></article>):<p>Nenhum cálculo salvo.</p>}
        {onNavigate&&<button onClick={()=>onNavigate('Cálculos')}>Novo cálculo</button>}</div>
      <div className="cbim-react-panel"><h2>Materiais e custos</h2>{work.materiais?.length?work.materiais.map((m:any)=><article key={m.id}><b>{m.material}</b> · {m.quantidade_realizada} {m.unidade} · {money(Number(m.quantidade_realizada||0)*Number(m.custo_unitario||0))}</article>):<p>Nenhum material cadastrado.</p>}</div>
      <div className="cbim-react-panel"><h2>Documentos locais</h2>{work.documentos?.length?work.documentos.map((d:any)=><article key={d.id}><b>{d.nome}</b> · <small>{d.tipo||'arquivo'} · {d.criado_em||''}</small> <button onClick={()=>downloadAttachment(d)}>Baixar arquivo</button></article>):<p>Nenhum documento cadastrado.</p>}</div>
      <div className="cbim-react-panel"><h2>Histórico da obra</h2>{history.length?history.map((h:any)=><article key={h.id||h.criado_em}><b>{h.acao}</b> · {h.entidade} · <small>{h.criado_em||h.data||''}</small></article>):<p>Nenhuma ação registrada.</p>}</div>
    </>}
  </section>;
}
