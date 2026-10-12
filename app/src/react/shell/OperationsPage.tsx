
import React from 'react';
import {PurchaseMaterialTraceability} from './PurchaseMaterialTraceability';
import {filterScopedRecords} from '../../../../src/domain/workspaceScope.js';
import {resolveSourceRecord} from '../../../../src/domain/engineeringJourney.js';
import {MEASUREMENT_LINK,parseTraceLink} from '../../../../src/domain/p1Traceability.js';
import {
  listarFrentes, salvarFrente, listarSubfrentes, salvarSubfrente, listarChecklistFrente,
  salvarChecklistFrente, atualizarStatusChecklist, listarMedicoes, salvarMedicao,
  atualizarStatusMedicao, listarContratos, salvarContrato, salvarAditivoContrato,
  listarCompras, salvarCompra, atualizarRecebimentoCompra, atualizarPagamentoCompra, listarModuleLinks,
  listarOrcamento, salvarOrcamentoItem, atualizarRealizadoOrcamento
} from '../../../../storage/sqliteStore.js';

const currency=(v:any)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const number=(data:FormData,k:string)=>Number(data.get(k)||0);
const str=(data:FormData,k:string)=>String(data.get(k)||'').trim();
const views=['Frentes','Medições','Compras','Contratos','Orçamento'];
export function OperationsPage({db,obraId,scope={},onChange,target,onNavigate}:{db:any;obraId:string|null;scope?:any;onChange:()=>void;target?:any;onNavigate?:(route:string,target?:any)=>void}){
  const [view,setView]=React.useState('Frentes');
  React.useEffect(()=>{if(target?.kind==='medicao')setView('Medições');},[target?.kind,target?.id]);
  const [error,setError]=React.useState('');
  const [front,setFront]=React.useState('');
  const [contract,setContract]=React.useState('');
  const [measureApprover,setMeasureApprover]=React.useState('');
  const fronts=obraId?listarFrentes(db,obraId):[];
  const selectedFronts=fronts.filter((f:any)=>!scope.frenteId||f.id===scope.frenteId);
  const allMeasures=obraId?listarMedicoes(db,obraId):[];
  const measure=filterScopedRecords(allMeasures,scope,{frontField:'frente_id',dateField:'periodo'});
  const focused=target?.kind==='medicao'?resolveSourceRecord(allMeasures,measure,target.id):{record:null,outsideScope:false};
  const shownMeasures=focused.outsideScope?[focused.record,...measure]:measure;
  const bimLinks=obraId?listarModuleLinks(db,obraId).filter((l:any)=>l.module_id===MEASUREMENT_LINK).map((l:any)=>parseTraceLink(l)).filter(Boolean):[];
  const buys=obraId?filterScopedRecords(listarCompras(db,obraId),scope,{frontField:'frente_id',dateField:'pedido_em'}):[];
  // Contracts have no frente_id. Never present them as filtered by front.
  const contracts=obraId?filterScopedRecords(listarContratos(db,obraId),scope,{intervalStartField:'inicio',intervalEndField:'fim'}):[];
  const budgets=obraId?filterScopedRecords(listarOrcamento(db,obraId),scope,{frontField:'frente_id',dateField:'periodo'}):[];
  const selectedFront=scope.frenteId||front||selectedFronts[0]?.id||'';
  const selectedContract=contract||contracts[0]?.id||'';
  const mutate=(fn:()=>void)=>{try{fn();setError('');onChange();return true;}catch(e:any){setError(e.message);return false;}};
  const handle=(fn:(d:FormData)=>void)=>(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=event.currentTarget,values=new FormData(form);
    if(mutate(()=>fn(values)))form.reset();
  };
  if(!obraId)return <section className="cbim-react-section"><h1>Operação</h1><p>Selecione uma obra no painel Obras para acessar frentes, medições, compras, contratos e orçamento.</p></section>;
  return <section className="cbim-react-section"><h1>Operação de obra</h1><p>Fluxos persistidos nas tabelas canônicas do SQLite. Filtros de frente, competência e data são aplicados aos registros compatíveis.</p>
    {scope.frenteId&&<p role="status" className="studio-muted">Frente selecionada: medições, compras e itens de orçamento mostram apenas essa frente. Contratos não possuem frente vinculada e ficam ocultos enquanto o filtro estiver ativo.</p>}
    {(scope.periodo?.inicio||scope.periodo?.fim)&&<p className="studio-muted">Período: competência de medição/orçamento, data do pedido de compra e vigência do contrato. Registros sem data aplicável não entram no recorte.</p>}
    <nav className="cbim-react-toolbar" aria-label="Módulos operacionais">{views.map(v=><button key={v} className={v===view?'selected':''} onClick={()=>setView(v)}>{v}</button>)}</nav>
    {error&&<p role="alert">{error}</p>}
    {target?.kind==='medicao'&&!focused.record&&<p role="alert" className="cbim-react-panel">Medição de origem {target.id} não localizada nesta obra. O vínculo histórico não foi alterado; confira a obra ou o identificador no estudo BIM.</p>}
    {focused.outsideScope&&<p role="status" className="cbim-react-panel">A medição de origem está fora do filtro atual de frente ou período. Ela aparece destacada somente para inspeção; os filtros, demais registros e totais não foram modificados.</p>}
    {view==='Frentes'&&<>{(scope.periodo?.inicio||scope.periodo?.fim)&&<p className="studio-muted">Frentes e checklists são cadastros operacionais; sem período próprio para aplicar este filtro nesta visualização.</p>}<form className="cbim-react-panel" onSubmit={handle(d=>salvarFrente(db,obraId,{nome:str(d,'nome'),responsavel:str(d,'responsavel')}))}><h2>Nova frente de serviço</h2><div className="cbim-react-form-grid"><label>Nome<input name="nome" required/></label><label>Responsável<input name="responsavel"/></label></div><button type="submit">Cadastrar frente</button></form>
      <div className="cbim-react-panel"><h2>Frentes e subfrentes</h2>{selectedFronts.map((f:any)=><article key={f.id}><b>{f.nome}</b> · <small>{f.status} · {f.percentual_concluido}%</small><button onClick={()=>setFront(f.id)}>Gerenciar</button></article>)}</div>
      {selectedFront&&<><form className="cbim-react-panel" onSubmit={handle(d=>salvarSubfrente(db,selectedFront,{nome:str(d,'nome'),descricao:str(d,'descricao')}))}><h2>Nova subfrente</h2><label>Nome<input name="nome" required/></label><label>Descrição<input name="descricao"/></label><button type="submit">Salvar subfrente</button></form>
        <div className="cbim-react-panel">{listarSubfrentes(db,selectedFront).map((s:any)=><p key={s.id}>{s.nome} · {s.descricao}</p>)}</div>
        <form className="cbim-react-panel" onSubmit={handle(d=>salvarChecklistFrente(db,selectedFront,{item:str(d,'descricao'),responsavel:str(d,'responsavel')}))}><h2>Novo checklist</h2><label>Atividade<input name="descricao" required/></label><label>Responsável<input name="responsavel"/></label><button type="submit">Adicionar checklist</button></form>
        <div className="cbim-react-panel">{listarChecklistFrente(db,selectedFront).map((c:any)=><article key={c.id}>{c.item} · {c.status}<button onClick={()=>mutate(()=>atualizarStatusChecklist(db,c.id,c.status==='concluido'?'pendente':'concluido'))}>Alternar status</button></article>)}</div>
      </>}
    </>}
    {view==='Medições'&&<><form className="cbim-react-panel" onSubmit={handle(d=>salvarMedicao(db,obraId,{frenteId:str(d,'frente')||null,descricao:str(d,'descricao'),unidade:str(d,'unidade'),quantidade:number(d,'quantidade'),precoUnitario:number(d,'preco'),periodo:str(d,'periodo')}))}>
      <h2>Nova medição</h2><div className="cbim-react-form-grid"><label>Descrição<input required name="descricao"/></label><label>Frente<select key={scope.frenteId||'todas'} name="frente" defaultValue={scope.frenteId||''}><option value="">Geral</option>{fronts.map((f:any)=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
      <label>Período<input name="periodo" placeholder="AAAA-MM" defaultValue={scope.periodo?.inicio?.slice(0,7)||''} required/></label><label>Unidade<input name="unidade" defaultValue="m" required/></label><label>Quantidade<input type="number" min="0" step="any" name="quantidade" required/></label><label>Preço unitário<input type="number" min="0" step="any" name="preco" required/></label></div><button type="submit">Salvar medição</button></form>
      <div className="cbim-react-panel"><h2>Medições registradas</h2>
      <label>Responsável pela aprovação<input value={measureApprover} onChange={e=>setMeasureApprover(e.target.value)} placeholder="Nome de quem conferiu e aprovou"/></label>
      <p className="studio-muted">A aprovação é definitiva e fica registrada no histórico da obra. Para corrigir uma medição aprovada, crie uma retificação independente.</p>
      {shownMeasures.map((m:any)=><article key={m.id} className={target?.kind==='medicao'&&target.id===m.id?'cbim-journey-focus':''}><b>{m.descricao}</b> · {currency(m.quantidade*m.preco_unitario)} · {m.status} · {m.periodo}
       {target?.kind==='medicao'&&target.id===m.id&&<p role="status">Registro operacional de origem · {m.id} · {m.quantidade} {m.unidade} × {currency(m.preco_unitario)}. A medição aprovada não equivale a receita recebida.</p>}
       {onNavigate&&<div className="cbim-react-toolbar">
         {bimLinks.find((link:any)=>link.operationalId===m.id)&&<button type="button" onClick={()=>{const link=bimLinks.find((l:any)=>l.operationalId===m.id);onNavigate('BIM',{kind:'bim-conciliacao',id:link.batchId,obraId,studyId:link.projectId,period:m.periodo});}}>Abrir conferência BIM</button>}
         <button type="button" onClick={()=>onNavigate('RDO',{kind:'rdo-competencia',period:m.periodo,obraId,studyId:target?.studyId||'',origin:{kind:'medicao',id:m.id,obraId,period:m.periodo}})}>Ver RDOs da competência</button>
         <button type="button" onClick={()=>onNavigate('Financeiro',{kind:'contas-competencia',period:m.periodo,obraId,studyId:target?.studyId||'',origin:{kind:'medicao',id:m.id,obraId,period:m.periodo}})}>Ver contas por vencimento</button>
       </div>}
       {m.status==='aprovada'?<p>Registro aprovado — não editável</p>:<select aria-label={'Status da medição '+m.descricao} value={m.status} onChange={e=>mutate(()=>atualizarStatusMedicao(db,m.id,e.target.value,measureApprover))}>
        {['rascunho','conferida','aprovada','rejeitada'].map(s=><option key={s} value={s}>{s}</option>)}</select>}
      </article>)}</div>
    </>}
    {view==='Compras'&&<><form className="cbim-react-panel" onSubmit={handle(d=>salvarCompra(db,obraId,{fornecedor:str(d,'fornecedor'),descricao:str(d,'descricao'),quantidade:number(d,'quantidade'),unidade:str(d,'unidade'),valorTotal:number(d,'valor'),frenteId:str(d,'frente')||null}))}><h2>Novo pedido de compra</h2><div className="cbim-react-form-grid"><label>Fornecedor<input name="fornecedor" required/></label><label>Descrição<input name="descricao" required/></label><label>Frente<select key={scope.frenteId||'todas'} name="frente" defaultValue={scope.frenteId||''}><option value="">Geral</option>{fronts.map((f:any)=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label><label>Quantidade<input type="number" min="0" step="any" name="quantidade" required/></label><label>Unidade<input name="unidade" defaultValue="un"/></label><label>Valor total<input type="number" min="0" step="any" name="valor" required/></label></div><button type="submit">Criar pedido</button></form>
      <div className="cbim-react-panel"><h2>Recebimento e pagamento</h2>{buys.map((b:any)=><article key={b.id}><b>{b.fornecedor}</b> · {b.descricao} · {currency(b.valor_total)}<p>{b.status} · {b.recebido}/{b.quantidade} {b.unidade}</p><div className="cbim-react-toolbar"><label>Recebido<input type="number" min="0" max={b.quantidade} step="any" defaultValue={b.recebido} onBlur={e=>{if(Number(e.target.value)!==Number(b.recebido))mutate(()=>atualizarRecebimentoCompra(db,b.id,Number(e.target.value)));}}/></label><label>Pagamento<select value={b.pagamento_status} onChange={e=>mutate(()=>atualizarPagamentoCompra(db,b.id,e.target.value))}>{['pendente','programado','pago'].map(s=><option key={s} value={s}>{s}</option>)}</select></label></div></article>)}</div>
      <PurchaseMaterialTraceability db={db} obraId={obraId} purchases={buys} onChange={onChange} onNavigate={onNavigate}/>
    </>}
    {view==='Contratos'&&scope.frenteId&&<p className="cbim-react-panel">Contratos não possuem vínculo de frente. Limpe a frente no cabeçalho para consultar ou cadastrar contratos da obra.</p>}
    {view==='Contratos'&&!scope.frenteId&&<><form className="cbim-react-panel" onSubmit={handle(d=>salvarContrato(db,obraId,{fornecedor:str(d,'fornecedor'),objeto:str(d,'objeto'),valor:number(d,'valor'),inicio:str(d,'inicio'),fim:str(d,'fim')}))}><h2>Novo contrato</h2><div className="cbim-react-form-grid"><label>Fornecedor<input name="fornecedor" required/></label><label>Objeto<input name="objeto" required/></label><label>Valor<input type="number" min="0" step="any" name="valor" required/></label><label>Início<input type="date" name="inicio"/></label><label>Término<input type="date" name="fim"/></label></div><button type="submit">Salvar contrato</button></form>
      <div className="cbim-react-panel"><h2>Contratos</h2>{contracts.map((c:any)=><article key={c.id}><b>{c.fornecedor}</b> · {c.objeto} · {currency(c.valor)} · {c.status}<button onClick={()=>setContract(c.id)}>Aditivos ({c.aditivos?.length||0})</button></article>)}</div>
      {selectedContract&&<><form className="cbim-react-panel" onSubmit={handle(d=>salvarAditivoContrato(db,selectedContract,{descricao:str(d,'descricao'),valor:number(d,'valor'),data:str(d,'data')}))}><h2>Novo aditivo</h2><label>Descrição<input name="descricao" required/></label><label>Valor<input type="number" name="valor" step="any" required/></label><label>Data<input type="date" name="data"/></label><button type="submit">Adicionar aditivo</button></form>
        <div className="cbim-react-panel">{contracts.find((c:any)=>c.id===selectedContract)?.aditivos?.map((a:any)=><p key={a.id}>{a.descricao} · {currency(a.valor)}</p>)}</div></>}
    </>}
    {view==='Orçamento'&&<><form className="cbim-react-panel" onSubmit={handle(d=>salvarOrcamentoItem(db,obraId,{categoria:str(d,'categoria'),descricao:str(d,'descricao'),periodo:str(d,'periodo'),planejado:number(d,'planejado'),realizado:number(d,'realizado'),frenteId:str(d,'frente')||null}))}><h2>Novo item de orçamento</h2><div className="cbim-react-form-grid"><label>Categoria<input name="categoria" required/></label><label>Descrição<input name="descricao" required/></label><label>Frente<select key={scope.frenteId||'todas'} name="frente" defaultValue={scope.frenteId||''}><option value="">Geral</option>{fronts.map((f:any)=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label><label>Competência<input name="periodo" placeholder="AAAA-MM" defaultValue={scope.periodo?.inicio?.slice(0,7)||''} required/></label><label>Planejado<input type="number" step="any" min="0" name="planejado" required/></label><label>Realizado<input type="number" step="any" min="0" name="realizado" defaultValue="0"/></label></div><button type="submit">Salvar orçamento</button></form>
      <div className="cbim-react-metrics"><article>Planejado: {currency(budgets.reduce((s:number,i:any)=>s+Number(i.planejado),0))}</article><article>Realizado: {currency(budgets.reduce((s:number,i:any)=>s+Number(i.realizado),0))}</article></div>
      <div className="cbim-react-panel">{budgets.map((o:any)=><article key={o.id}><b>{o.categoria}</b> · {o.descricao} · {o.periodo}<p>{currency(o.planejado)} previsto · {currency(o.realizado)} realizado</p><label>Realizado atualizado<input type="number" min="0" step="any" defaultValue={o.realizado} onBlur={e=>{if(Number(e.target.value)!==Number(o.realizado))mutate(()=>atualizarRealizadoOrcamento(db,o.id,Number(e.target.value)));}}/></label></article>)}</div>
    </>}
  </section>;
}
