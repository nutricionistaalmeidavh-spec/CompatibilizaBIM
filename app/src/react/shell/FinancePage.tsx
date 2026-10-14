import React from 'react';
import {ModuleHero,ModuleKpis} from './EngineeringModuleLayout';
import {brlReais} from '../../../../src/factory/format.js';
import {reconciliarFinanceiroObra} from '../../../../src/domain/financialReconciliation.js';
import {filterScopedRecords,financialScopeRows} from '../../../../src/domain/workspaceScope.js';
import {filterEntriesByDueCompetence,resolveSourceRecord} from '../../../../src/domain/engineeringJourney.js';
import { listarLancamentosFinanceiros, salvarLancamentoFinanceiro, listarFolhaPagamentos, salvarFolhaPagamento, listarContratos, listarMedicoes, listarCompras, listarFrentes } from '../../../../storage/sqliteStore.js';

const money=brlReais;
const safe=(d:FormData,k:string)=>String(d.get(k)||'').trim();

export function FinancePage({db,obraId,scope={},onChange,target,onNavigate}:{db:any;obraId:string|null;scope?:any;onChange:()=>void;target?:any;onNavigate?:(route:string,target?:any)=>void}){
  const [active,setActive]=React.useState<'DRE'|'Contas'|'Folha'>('DRE');
  React.useEffect(()=>{if(target?.kind==='contas-competencia'||target?.kind==='lancamento')setActive('Contas');},[target?.kind,target?.id,target?.period]);
  const [error,setError]=React.useState('');
  const frontScoped=!!scope.frenteId;
  const scoped={obraId,frenteId:scope.frenteId||null,periodo:scope.periodo||{}};
  const allEntries=listarLancamentosFinanceiros(db,obraId);
  const {rows:entries,unallocated}=financialScopeRows(allEntries,scoped);
  const relevantEntries=allEntries.filter((entry:any)=>obraId?entry.obra_id===obraId:true);
  const dueEntries=target?.kind==='contas-competencia'?filterEntriesByDueCompetence(relevantEntries,target.period):[];
  const sourceEntry=target?.kind==='lancamento'?resolveSourceRecord(relevantEntries,entries,target.id):{record:null,outsideScope:false};
  const visibleEntries=sourceEntry.outsideScope?[sourceEntry.record,...entries]:entries;
  const payroll=frontScoped?[]:filterScopedRecords(
    listarFolhaPagamentos(db,obraId).filter((p:any)=>!obraId||p.obra_id===obraId),
    scoped,{dateField:'periodo'}
  );
  const contracts=obraId?filterScopedRecords(listarContratos(db,obraId),scoped,{intervalStartField:'inicio',intervalEndField:'fim'}):[];
  const measures=obraId?filterScopedRecords(listarMedicoes(db,obraId),scoped,{frontField:'frente_id',dateField:'periodo'}):[];
  const fronts=obraId?listarFrentes(db,obraId).filter((f:any)=>!frontScoped||f.id===scope.frenteId):[];
  const purchases=obraId?filterScopedRecords(listarCompras(db,obraId),scoped,{frontField:'frente_id',dateField:'pedido_em'}):[];
  const audit=reconciliarFinanceiroObra({obraId,entries,measures,purchases,contracts});
  const receitas=entries.filter((e:any)=>e.tipo==='receita').reduce((v:number,e:any)=>v+Number(e.valor),0);
  const despesas=entries.filter((e:any)=>e.tipo==='despesa').reduce((v:number,e:any)=>v+Number(e.valor),0);
  const submit=(fn:(d:FormData)=>void)=>(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=event.currentTarget,d=new FormData(form);
    try{fn(d);form.reset();setError('');onChange();}catch(e:any){setError(e.message||String(e));}
  };
  return <section className="cbim-react-section cbim-p5-module cbim-p5-finance" data-testid="cbim-p5-finance">
    <ModuleHero area="OBRA / CONTROLE FINANCEIRO" title="Financeiro local"
     description={(obraId?'Visão da obra selecionada':'Visão consolidada dos lançamentos')+' · valores registrados no SQLite, sem conciliação bancária nem DRE contábil homologada.'}
     meta={frontScoped?'Frente ativa · totais globais ocultos':obraId?'Visão da obra':'Visão consolidada'}/>
    <ModuleKpis items={frontScoped?[
      {label:'Medições aprovadas da frente',value:money(audit.medicoesAprovadas),source:'Não representa receita recebida'},
      {label:'Compras pendentes da frente',value:money(audit.comprasPendentesPagamento),source:'Compromissos da frente',tone:'amber'}
    ]:[
      {label:'Receitas lançadas',value:money(receitas),source:'Não equivale a recebimento bancário'},
      {label:'Despesas lançadas',value:money(despesas),source:'Movimentações registradas',tone:'amber'},
      {label:'Resultado registrado',value:money(receitas-despesas),source:'Saldo previsto; não contábil',tone:'green'},
      {label:'Folha prevista',value:money(payroll.reduce((sum:number,p:any)=>sum+Number(p.valor_bruto),0)),source:'Registros da competência',tone:'purple'}
    ]}/>
    <nav className="cbim-react-toolbar" aria-label="Financeiro">{(['DRE','Contas','Folha'] as const).map(tab=><button key={tab} className={active===tab?'selected':''} onClick={()=>setActive(tab)}>{tab}</button>)}</nav>
    {error&&<p role="alert" className="cbim-react-error">{error}</p>}
    {target?.kind==='contas-competencia'&&<section className="cbim-react-panel cbim-journey-focus" aria-label="Conferência de contas por vencimento">
      <h2>Lançamentos com vencimento em {target.period}</h2>
      <p>Vinculado à obra, não à medição BIM. O vínculo com RDO ou medição é somente por competência temporal. Esta consulta de origem pode mostrar itens fora dos filtros, sem incluí-los nos totais filtrados. Os valores são lançamentos registrados; não comprovam recebimento ou pagamento bancário.</p>
      {dueEntries.map((entry:any)=><article key={entry.id}><b>{entry.descricao}</b> · {entry.categoria} · {entry.tipo} · {money(entry.valor)} · {entry.status} · vencimento {entry.vencimento}
       {onNavigate&&<button type="button" onClick={()=>onNavigate('Financeiro',{kind:'lancamento',id:entry.id,obraId,period:target.period,studyId:target.studyId})}>Inspecionar lançamento original</button>}
      </article>)}
      {!dueEntries.length&&<p>Nenhum lançamento registrado com vencimento nesta competência. Isso não comprova ausência de custos ou pagamentos.</p>}
    </section>}
    {target?.kind==='lancamento'&&!sourceEntry.record&&<p role="alert">Lançamento de origem {target.id} não encontrado nesta obra. A referência não foi alterada.</p>}
    {sourceEntry.outsideScope&&<p role="status">O lançamento de origem está fora dos filtros. Está visível para consulta individual, sem alterar os indicadores agregados.</p>}
    {scope.periodo?.inicio||scope.periodo?.fim?<p className="studio-muted">Filtro de período: vencimento dos lançamentos, competência da folha, período das medições e data dos pedidos. Lançamentos sem vencimento não entram nos totais filtrados.</p>:null}
    {frontScoped&&<p role="status" className="cbim-react-panel">Frente selecionada: apenas compras e medições com vínculo à frente são exibidas. Contas, folha e contratos não têm frente de serviço em seus registros; seus totais não serão apresentados como se fossem desta frente. Limpe a frente no cabeçalho para consultar os totais da obra.</p>}
    {!frontScoped&&obraId&&unallocated.length>0&&<p className="studio-muted">{unallocated.length} lançamento(s) sem obra vinculada ficam fora dos totais da obra. Estão disponíveis na visão consolidada sem obra selecionada.</p>}
    {active==='DRE'&&<>
      {!frontScoped&&<>

        <div className="cbim-react-metrics">
          {obraId&&<><article>Contratado: {money(audit.contratado)}</article><article>Medições aprovadas (não recebidas): {money(audit.medicoesAprovadas)}</article></>}
          <article>Despesas pagas registradas: {money(audit.despesasPagas)}</article>
          <article>Receitas recebidas registradas: {money(audit.receitasRecebidas)}</article>
          <article>Saldo registrado (não conciliado): {money(audit.saldoCaixaRegistrado)}</article>
          {obraId&&<article>Compromissos de compra pendentes: {money(audit.comprasPendentesPagamento)}</article>}
        </div>
        <p role="status" className="studio-muted">{audit.observacao} Receitas e despesas lançadas não são equivalentes a movimentos bancários.</p>
      </>}
      {frontScoped&&<div className="cbim-react-metrics"><article>Medições aprovadas da frente: {money(audit.medicoesAprovadas)}</article><article>Compromissos de compra pendentes da frente: {money(audit.comprasPendentesPagamento)}</article></div>}
      {obraId&&<div className="cbim-react-panel"><h2>Fluxo de medições por frente</h2>
        <p className="studio-muted">Medições aprovadas são direitos a conferir; nenhuma medição gera recebimento financeiro automaticamente.</p>
        {onNavigate&&measures.filter((m:any)=>m.status==='aprovada').map((m:any)=><div className="cbim-react-toolbar" key={m.id}><span>{m.descricao} · {m.periodo} · {money(Number(m.quantidade)*Number(m.preco_unitario))} aprovado (não recebido)</span>
         <button type="button" onClick={()=>onNavigate('Operação',{kind:'medicao',id:m.id,obraId,period:m.periodo})}>Ver medição de origem</button></div>)}
        {fronts.map((f:any)=><article key={f.id}><b>{f.nome}</b> · {money(measures.filter((m:any)=>m.frente_id===f.id&&m.status==='aprovada').reduce((sum:number,m:any)=>sum+Number(m.quantidade)*Number(m.preco_unitario),0))} aprovado · {measures.filter((m:any)=>m.frente_id===f.id).length} registro(s)</article>)}
        {!fronts.length&&<p>Nenhuma frente vinculada ao contexto selecionado.</p>}
      </div>}
      {!frontScoped&&<div className="cbim-react-panel"><h2>Lançamentos por categoria</h2>
        {Object.entries(entries.reduce((acc:any,e:any)=>{const k=e.tipo+' / '+e.categoria;acc[k]=(acc[k]||0)+Number(e.valor);return acc;},{})).map(([k,v])=><p key={k}>{k} · {money(v)}</p>)}
        {!entries.length&&<p>Nenhum lançamento para este contexto e período.</p>}
      </div>}
    </>}
    {active==='Contas'&&(frontScoped?<p className="cbim-react-panel">Contas são vinculadas à obra, mas não à frente. Limpe o filtro de frente para criar ou consultar lançamentos sem interpretação incorreta.</p>:<>
      <form className="cbim-react-panel" onSubmit={submit(d=>salvarLancamentoFinanceiro(db,{obraId,tipo:safe(d,'tipo'),categoria:safe(d,'categoria'),descricao:safe(d,'descricao'),valor:Number(d.get('valor')),vencimento:safe(d,'vencimento'),status:safe(d,'status')}))}>
        <h2>Novo lançamento</h2><div className="cbim-react-form-grid">
          <label>Tipo<select name="tipo"><option value="receita">Receita</option><option value="despesa">Despesa</option></select></label>
          <label>Categoria<input name="categoria" required/></label>
          <label>Descrição<input name="descricao" required/></label>
          <label>Valor<input type="number" min="0" step="any" name="valor" required/></label>
          <label>Vencimento<input type="date" name="vencimento"/></label>
          <label>Status<select name="status"><option value="previsto">Previsto</option><option value="confirmado">Confirmado (a receber)</option><option value="recebido">Recebido (receita)</option><option value="pago">Pago (despesa)</option></select></label>
        </div><button type="submit">Salvar lançamento</button>
      </form>
      <div className="cbim-react-panel"><h2>Contas a pagar e receber</h2>
        {visibleEntries.map((e:any)=><article key={e.id} className={target?.kind==='lancamento'&&target.id===e.id?'cbim-journey-focus':''}><b>{e.descricao}</b> · {e.categoria}<p>{e.tipo} · {money(e.valor)} · {e.status} · {e.vencimento||'Sem vencimento'}</p></article>)}
        {!visibleEntries.length&&<p>Nenhum lançamento para o período/obra selecionados.</p>}
      </div>
    </>)}
    {active==='Folha'&&(frontScoped?<p className="cbim-react-panel">Folha possui vínculo de obra, mas não de frente. Limpe o filtro para consultar os registros da obra.</p>:<>
      <form className="cbim-react-panel" onSubmit={submit(d=>salvarFolhaPagamento(db,{obraId,colaborador:safe(d,'nome'),funcao:safe(d,'funcao'),periodo:safe(d,'periodo'),valorBruto:Number(d.get('valor')),status:safe(d,'status')}))}>
        <h2>Registrar folha</h2><div className="cbim-react-form-grid">
          <label>Colaborador<input name="nome" required/></label>
          <label>Função<input name="funcao"/></label>
          <label>Competência<input name="periodo" placeholder="2026-10" defaultValue={scope.periodo?.inicio?.slice(0,7)||''} required/></label>
          <label>Valor bruto<input type="number" min="0" step="any" name="valor" required/></label>
          <label>Status<select name="status"><option value="previsto">Previsto</option><option value="pago">Pago</option></select></label>
        </div><button type="submit">Salvar folha</button>
      </form>
      <div className="cbim-react-panel"><h2>Histórico de folha</h2>
        {payroll.map((p:any)=><article key={p.id}><b>{p.colaborador}</b> · {p.periodo}<p>{p.funcao} · {money(p.valor_bruto)} · {p.status}</p></article>)}
        {!payroll.length&&<p>Nenhum registro na competência selecionada.</p>}
      </div>
    </>)}
  </section>;
}
