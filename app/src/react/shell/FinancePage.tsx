import React from 'react';
import {brlReais} from '../../../../src/factory/format.js';
import {reconciliarFinanceiroObra} from '../../../../src/domain/financialReconciliation.js';
import {filterScopedRecords,financialScopeRows} from '../../../../src/domain/workspaceScope.js';
import { listarLancamentosFinanceiros, salvarLancamentoFinanceiro, listarFolhaPagamentos, salvarFolhaPagamento, listarContratos, listarMedicoes, listarCompras, listarFrentes } from '../../../../storage/sqliteStore.js';

const money=brlReais;
const safe=(d:FormData,k:string)=>String(d.get(k)||'').trim();

export function FinancePage({db,obraId,scope={},onChange}:{db:any;obraId:string|null;scope?:any;onChange:()=>void}){
  const [active,setActive]=React.useState<'DRE'|'Contas'|'Folha'>('DRE');
  const [error,setError]=React.useState('');
  const frontScoped=!!scope.frenteId;
  const scoped={obraId,frenteId:scope.frenteId||null,periodo:scope.periodo||{}};
  const {rows:entries,unallocated}=financialScopeRows(listarLancamentosFinanceiros(db,obraId),scoped);
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
  return <section className="cbim-react-section">
    <h1>Financeiro local</h1>
    <p>{obraId?'Visão da obra selecionada':'Visão consolidada de lançamentos da empresa'} · valores registrados localmente, sem conciliação bancária ou DRE contábil homologada.</p>
    <nav className="cbim-react-toolbar" aria-label="Financeiro">{(['DRE','Contas','Folha'] as const).map(tab=><button key={tab} className={active===tab?'selected':''} onClick={()=>setActive(tab)}>{tab}</button>)}</nav>
    {error&&<p role="alert" className="cbim-react-error">{error}</p>}
    {scope.periodo?.inicio||scope.periodo?.fim?<p className="studio-muted">Filtro de período: vencimento dos lançamentos, competência da folha, período das medições e data dos pedidos. Lançamentos sem vencimento não entram nos totais filtrados.</p>:null}
    {frontScoped&&<p role="status" className="cbim-react-panel">Frente selecionada: apenas compras e medições com vínculo à frente são exibidas. Contas, folha e contratos não têm frente de serviço em seus registros; seus totais não serão apresentados como se fossem desta frente. Limpe a frente no cabeçalho para consultar os totais da obra.</p>}
    {!frontScoped&&obraId&&unallocated.length>0&&<p className="studio-muted">{unallocated.length} lançamento(s) sem obra vinculada ficam fora dos totais da obra. Estão disponíveis na visão consolidada sem obra selecionada.</p>}
    {active==='DRE'&&<>
      {!frontScoped&&<>
        <div className="cbim-react-metrics">
          <article>Receitas lançadas: {money(receitas)}</article>
          <article>Despesas lançadas: {money(despesas)}</article>
          <article>Resultado previsto (não contábil): {money(receitas-despesas)}</article>
          <article>Folha prevista: {money(payroll.reduce((sum:number,p:any)=>sum+Number(p.valor_bruto),0))}</article>
        </div>
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
        {entries.map((e:any)=><article key={e.id}><b>{e.descricao}</b> · {e.categoria}<p>{e.tipo} · {money(e.valor)} · {e.status} · {e.vencimento||'Sem vencimento'}</p></article>)}
        {!entries.length&&<p>Nenhum lançamento para o período/obra selecionados.</p>}
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
