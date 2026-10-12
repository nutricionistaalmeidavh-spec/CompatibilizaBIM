
import React from 'react';
import {buscarObra, criarObraPersistida, listarObras, salvarEtapa, salvarPendencia, salvarRdo, salvarMaterial, salvarDocumento, listarHistorico, listarFrentes, salvarFrente} from '../../../../storage/sqliteStore.js';
type Props={db:any;obraId:string|null;selectWork:(id:string|null)=>void;onChange:()=>void};
export function WorksPage({db,obraId,selectWork,onChange}:Props){
  const [newWork,setNewWork]=React.useState(false);
  const [task,setTask]=React.useState('etapa');
  const [error,setError]=React.useState('');
  const works=listarObras(db);
  const work=obraId?buscarObra(db,obraId):null;
  const history=obraId?listarHistorico(db,obraId):[];
  const perform=(operation:()=>void)=>{
    try {operation();setError('');onChange();}catch(e:any){setError(e.message);}
  };
  const createWork=(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const d=new FormData(e.currentTarget);
    perform(()=>{const id=criarObraPersistida(db,{codigo:String(d.get('codigo')),nome:String(d.get('nome')),cliente:String(d.get('cliente')||''),endereco:String(d.get('endereco')||''),responsavelTecnico:String(d.get('responsavel')||'')});selectWork(id);setNewWork(false);});
  };
  const add=(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!work)return;
    const d=new FormData(e.currentTarget);
    perform(()=>{
      if(task==='etapa')salvarEtapa(db,work.id,{nome:String(d.get('nome')),percentualPeso:Number(d.get('peso')||0),responsavel:String(d.get('responsavel')||'')});
      if(task==='pendencia')salvarPendencia(db,work.id,{descricao:String(d.get('nome')),responsavel:String(d.get('responsavel')||''),prioridade:String(d.get('prioridade')||'media')});
      if(task==='rdo')salvarRdo(db,work.id,{data:String(d.get('data')||new Date().toISOString().slice(0,10)),turno:String(d.get('turno')||'diurno'),responsavel:String(d.get('responsavel')||''),observacoes:String(d.get('nome')||'')});
      if(task==='material')salvarMaterial(db,work.id,{material:String(d.get('nome')),unidade:String(d.get('unidade')||'un'),quantidadePlanejada:Number(d.get('peso')||0),custoUnitario:Number(d.get('custo')||0)});
      if(task==='frente')salvarFrente(db,work.id,{nome:String(d.get('nome')),responsavel:String(d.get('responsavel')||'')});
    });
    e.currentTarget.reset();
  };
  return <section className="cbim-react-section"><h1>Obras e gestão local</h1><p>Os registros são persistidos no SQLite canônico, sem cópia ou banco paralelo.</p>
    <div className="cbim-react-toolbar"><label>Obra atual<select value={obraId||''} onChange={e=>selectWork(e.target.value||null)}><option value="">Todas as obras</option>{works.map((w:any)=><option value={w.id} key={w.id}>{w.codigo} · {w.nome}</option>)}</select></label>
      <button onClick={()=>setNewWork(v=>!v)}>{newWork?'Cancelar':'+ Nova obra'}</button></div>
    {newWork&&<form className="cbim-react-panel cbim-react-form-grid" onSubmit={createWork}>
      <label>Código<input name="codigo" required/></label><label>Nome<input name="nome" required/></label><label>Cliente<input name="cliente"/></label><label>Endereço<input name="endereco"/></label><label>Responsável técnico<input name="responsavel"/></label><button type="submit">Criar obra</button>
    </form>}
    {error&&<p role="alert">{error}</p>}
    <div className="cbim-react-card-grid">{works.map((w:any)=><button key={w.id} className={obraId===w.id?'selected':''} onClick={()=>selectWork(w.id)}><b>{w.nome}</b><small>{w.codigo} · {w.status} · {Math.round(w.percentual_concluido||0)}% concluído</small><small>{w.rdos_total} RDO · {w.pendencias_abertas} pendências</small></button>)}</div>
    {work&&<><div className="cbim-react-metrics"><article>Etapas: {work.etapas?.length||0}</article><article>RDO: {work.rdos?.length||0}</article><article>Pendências: {work.pendencias?.length||0}</article><article>Frentes: {listarFrentes(db,work.id).length}</article></div>
      <form className="cbim-react-panel" onSubmit={add}>
        <h2>Novo registro</h2><div className="cbim-react-form-grid">
          <label>Tipo<select value={task} onChange={e=>setTask(e.target.value)}><option value="etapa">Etapa</option><option value="pendencia">Pendência</option><option value="rdo">Diário de obra</option><option value="material">Material</option><option value="frente">Frente de serviço</option></select></label>
          <label>{task==='rdo'?'Descrição do RDO':'Nome ou descrição'}<input name="nome" required/></label>
          <label>Responsável<input name="responsavel"/></label>
          {(task==='etapa'||task==='material')&&<label>{task==='etapa'?'Peso (%)':'Quantidade planejada'}<input type="number" name="peso" step="any" defaultValue="0"/></label>}
          {task==='material'&&<><label>Unidade<input name="unidade" defaultValue="un"/></label><label>Custo unitário<input name="custo" type="number" step="any" defaultValue="0"/></label></>}
          {task==='pendencia'&&<label>Prioridade<select name="prioridade"><option value="media">Média</option><option value="alta">Alta</option><option value="baixa">Baixa</option></select></label>}
          {task==='rdo'&&<><label>Data<input name="data" type="date" defaultValue={new Date().toISOString().slice(0,10)}/></label><label>Turno<select name="turno"><option value="diurno">Diurno</option><option value="noturno">Noturno</option></select></label></>}
        </div><button type="submit">Salvar registro</button>
      </form>
      <div className="cbim-react-panel"><h2>Histórico da obra</h2>{history.length?history.slice(0,30).map((h:any)=><article key={h.id||h.criado_em}><b>{h.acao}</b> · {h.entidade} · <small>{h.criado_em||h.data||''}</small></article>):<p>Nenhuma ação auditada nesta obra.</p>}</div>
    </>}
  </section>;
}
