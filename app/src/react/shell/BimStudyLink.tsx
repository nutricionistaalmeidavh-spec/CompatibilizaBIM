import React from 'react';
import { salvarEstudoEngenhariaBim, listarEstudosEngenhariaBim } from '../../../../storage/sqliteStore.js';
import { opcoesElementosBim, estadoVinculoBim } from '../../../../src/engineering/contextualStudies.js';
import { listarResultadosTecnicos, formatarValorTecnico } from '../../../../src/engineering/mathPresentation.js';

type Props={db:any;obraId:string|null;project:any;calculator:string;entry:any;result:any;alternatives:any[];onSaved:()=>void};
export function BimStudyLink({db,obraId,project,calculator,entry,result,alternatives,onSaved}:Props) {
  const [modelId,setModelId]=React.useState('');
  const [analysisId,setAnalysisId]=React.useState('');
  const [conflictKey,setConflictKey]=React.useState('');
  const [elementRef,setElementRef]=React.useState('');
  const [note,setNote]=React.useState('');
  const [error,setError]=React.useState('');
  const [notice,setNotice]=React.useState('');
  const models=project.modelos||[];
  const model=models.find((m:any)=>m.id===modelId);
  const analyses=(project.analises||[]).filter((a:any)=>a.modelo_a_id===modelId||a.modelo_b_id===modelId||
    (()=>{try{return JSON.parse(a.modelos_json||'[]').includes(modelId);}catch{return false;}})());
  const analysis=analyses.find((a:any)=>a.id===analysisId);
  const conflicts=(analysis?.conflitos||[]).filter((c:any)=>(c.modelos||[]).includes(modelId));
  const elements=opcoesElementosBim(project,modelId,analysisId);
  const save=()=>{
    try{
      if(project.obra_id&&obraId&&project.obra_id!==obraId)throw Error('Selecione a obra de origem ou limpe o contexto de obra.');
      const id=salvarEstudoEngenhariaBim(db,{
        projetoId:project.id,obraId,modeloId:modelId,analiseId:analysisId,conflitoChave:conflictKey,elementoRef,
        calculadoraTipo:calculator,titulo:entry.label,entradas:result.inputs,resultados:result.output,
        alternativas,nota:note
      });
      setNotice('Estudo preliminar registrado no projeto BIM. ID: '+id);
      setError('');onSaved();
    }catch(e:any){setError(e.message||String(e));setNotice('');}
  };
  return <section className="cbim-bim-study" aria-label="Vincular memória ao contexto BIM">
    <h3>Registrar memória no estudo BIM</h3>
    <p className="studio-muted">Projeto: {project.nome} · {project.obra_id?'vinculado à obra '+project.obra_id:'independente de obra'}. A associação é explícita e preserva revisão e origem; não edita o modelo ou a pendência.</p>
    {!models.length?<p role="status">Importe primeiro um modelo no módulo BIM para criar memórias contextualizadas.</p>:<>
      <div className="cbim-react-form-grid">
        <label>Modelo de origem<select required value={modelId} onChange={e=>{setModelId(e.target.value);setAnalysisId('');setConflictKey('');setElementRef('');setNotice('');}}>
          <option value="">Selecione o modelo</option>{models.map((m:any)=><option key={m.id} value={m.id}>{m.nome} · rev. {m.revisao} · {m.disciplina}</option>)}
        </select></label>
        <label>Análise de conflitos (opcional)<select value={analysisId} disabled={!modelId} onChange={e=>{setAnalysisId(e.target.value);setConflictKey('');setElementRef('');setNotice('');}}>
          <option value="">Sem análise vinculada</option>{analyses.map((a:any)=><option key={a.id} value={a.id}>{a.id} · {a.modo} · {a.criado_em}</option>)}
        </select></label>
        <label>Pendência BIM (opcional)<select value={conflictKey} disabled={!analysisId} onChange={e=>{setConflictKey(e.target.value);setElementRef('');setNotice('');}}>
          <option value="">Sem pendência</option>{conflicts.map((c:any)=><option key={c.chave} value={c.chave}>{(c.aGlobalId||'A')+' × '+(c.bGlobalId||'B')} · {c.status||'aberto'}</option>)}
        </select></label>
        <label>Elemento do modelo (opcional)<select value={elementRef} disabled={!modelId} onChange={e=>{setElementRef(e.target.value);setNotice('');}}>
          <option value="">Somente modelo</option>{elements.filter((el:any)=>{
            if(!conflictKey)return true;
            const c=conflicts.find((x:any)=>x.chave===conflictKey);
            const side=(c?.modelos||[]).indexOf(modelId);
            const ref=side===0?c?.aGlobalId:side===1?c?.bGlobalId:null;
            return !ref||el.ref===ref;
          }).map((el:any)=><option key={el.ref} value={el.ref}>{el.label} · {el.origem}</option>)}
        </select></label>
      </div>
      <label>Justificativa ou hipótese considerada<textarea rows={2} value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} placeholder="Anote as hipóteses de cálculo e pontos a conferir"/></label>
      {model&&<p className="studio-muted">Proveniência selecionada: revisão {model.revisao}, hash de arquivo {model.arquivo_hash||'não disponível'} · {model.elementos?.length||0} elementos catalogados.</p>}
      <div className="cbim-react-toolbar"><button type="button" disabled={!modelId||!result.validation?.ok} onClick={save}>Salvar estudo preliminar vinculado</button></div>
      {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="cbim-react-error">{error}</p>}
    </>}
  </section>;
}

export function BimStudiesHistory({db,project}:{db:any;project:any}) {
 const [expanded,setExpanded]=React.useState('');
 const items=listarEstudosEngenhariaBim(db,project.id);
 return <section className="cbim-react-panel" aria-label="Histórico de estudos vinculados">
   <h2>Memórias de engenharia vinculadas · {project.nome}</h2>
   <p className="studio-muted">Registros imutáveis. Mudanças no modelo ou na evidência do conflito não alteram a memória original, mas a tornam pendente de reconferência.</p>
   {!items.length&&<p>Este estudo ainda não possui memórias vinculadas.</p>}
   <div className="cbim-bim-history">{items.slice(0,40).map((record:any)=>{
     const state=estadoVinculoBim(record.contexto,project);
     const model=project.modelos?.find((m:any)=>m.id===record.modelo_id);
     return <article key={record.id}>
       <div><strong>{record.titulo}</strong> · {record.status==='preliminar'?'Preliminar':'Revisar estado'}
         <small>{model?.nome||record.modelo_id} · revisão registrada {record.contexto.revisao} · {record.criado_em} · {state.atual?'Origem atual':'Origem alterada'}</small>
         {!state.atual&&<p role="status">{state.motivo}</p>}
         {record.conflito_chave&&<p><small>Conflito: {record.conflito_chave} · elemento {record.elemento_ref||'não selecionado'}</small></p>}
       </div>
       <button type="button" aria-expanded={expanded===record.id} onClick={()=>setExpanded(expanded===record.id?'':record.id)}>{expanded===record.id?'Ocultar memória':'Ver memória'}</button>
       {expanded===record.id&&<div className="cbim-bim-history-detail">
         {record.nota&&<p>{record.nota}</p>}
         <div className="cbim-math-results">{listarResultadosTecnicos(record.resultados).slice(0,40).map((r:any)=><div className="cbim-math-result" key={r.path}>
           <span>{r.label}</span><strong>{formatarValorTecnico(r.value)} {r.unit}</strong></div>)}</div>
         <p>{record.validacao.ok?'Oráculo matemático parcial aprovado':'Oráculo rejeitado'} · {record.alternativas.length} alternativa(s) registradas. Nenhuma aprovação normativa automática.</p>
       </div>}
     </article>;
   })}</div>
   {items.length>40&&<p>Exibindo 40 registros mais recentes.</p>}
 </section>;
}
