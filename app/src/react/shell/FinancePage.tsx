
import React from 'react';
import { listarLancamentosFinanceiros, salvarLancamentoFinanceiro, listarFolhaPagamentos, salvarFolhaPagamento } from '../../../../storage/sqliteStore.js';
const money=(v:any)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const safe=(d:FormData,k:string)=>String(d.get(k)||'').trim();
export function FinancePage({db,obraId,onChange}:{db:any;obraId:string|null;onChange:()=>void}) {
  const [active,setActive]=React.useState<'DRE'|'Contas'|'Folha'>('DRE');
  const [error,setError]=React.useState('');
  const entries=listarLancamentosFinanceiros(db,obraId);
  const payroll=listarFolhaPagamentos(db,obraId);
  const receitas=entries.filter((e:any)=>e.tipo==='receita').reduce((v:number,e:any)=>v+Number(e.valor),0);
  const despesas=entries.filter((e:any)=>e.tipo==='despesa').reduce((v:number,e:any)=>v+Number(e.valor),0);
  const submit=(fn:(d:FormData)=>void)=>(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const f=event.currentTarget,d=new FormData(f);
    try{fn(d);f.reset();setError('');onChange();}catch(e:any){setError(e.message);}
  };
  return <section className="cbim-react-section"><h1>Financeiro local</h1><p>Receitas, despesas e folha mantidas no SQLite existente. O DRE é gerado diretamente dos lançamentos registrados.</p>
    <nav className="cbim-react-toolbar" aria-label="Financeiro">{(['DRE','Contas','Folha'] as const).map(tab=><button key={tab} className={active===tab?'selected':''} onClick={()=>setActive(tab)}>{tab}</button>)}</nav>
    {error&&<p role="alert">{error}</p>}
    {active==='DRE'&&<><div className="cbim-react-metrics"><article>Receitas: {money(receitas)}</article><article>Despesas: {money(despesas)}</article><article>Saldo: {money(receitas-despesas)}</article><article>Folha prevista: {money(payroll.reduce((s:number,e:any)=>s+Number(e.valor_bruto),0))}</article></div>
      <div className="cbim-react-panel"><h2>Por categoria</h2>{Object.entries(entries.reduce((acc:any,e:any)=>{const k=e.tipo+' / '+e.categoria;acc[k]=(acc[k]||0)+Number(e.valor);return acc;},{})).map(([k,v])=><p key={k}>{k} · {money(v)}</p>)}</div></>}
    {active==='Contas'&&<><form className="cbim-react-panel" onSubmit={submit(d=>salvarLancamentoFinanceiro(db,{obraId,tipo:safe(d,'tipo'),categoria:safe(d,'categoria'),descricao:safe(d,'descricao'),valor:Number(d.get('valor')),vencimento:safe(d,'vencimento'),status:safe(d,'status')}))}><h2>Novo lançamento</h2>
      <div className="cbim-react-form-grid"><label>Tipo<select name="tipo"><option value="receita">Receita</option><option value="despesa">Despesa</option></select></label><label>Categoria<input name="categoria" required/></label><label>Descrição<input name="descricao" required/></label><label>Valor<input type="number" min="0" step="any" name="valor" required/></label><label>Vencimento<input type="date" name="vencimento"/></label><label>Status<select name="status"><option value="previsto">Previsto</option><option value="confirmado">Confirmado</option></select></label></div>
      <button type="submit">Salvar lançamento</button></form>
      <div className="cbim-react-panel"><h2>Contas a pagar e receber</h2>{entries.map((e:any)=><article key={e.id}><b>{e.descricao}</b> · {e.categoria}<p>{e.tipo} · {money(e.valor)} · {e.status} · {e.vencimento||''}</p></article>)}</div></>}
    {active==='Folha'&&<><form className="cbim-react-panel" onSubmit={submit(d=>salvarFolhaPagamento(db,{obraId,colaborador:safe(d,'nome'),funcao:safe(d,'funcao'),periodo:safe(d,'periodo'),valorBruto:Number(d.get('valor')),status:safe(d,'status')}))}>
      <h2>Registrar folha</h2><div className="cbim-react-form-grid"><label>Colaborador<input name="nome" required/></label><label>Função<input name="funcao"/></label><label>Competência<input name="periodo" placeholder="2026-10" required/></label><label>Valor bruto<input type="number" min="0" step="any" name="valor" required/></label><label>Status<select name="status"><option value="previsto">Previsto</option><option value="pago">Pago</option></select></label></div><button type="submit">Salvar folha</button></form>
      <div className="cbim-react-panel"><h2>Histórico de folha</h2>{payroll.map((p:any)=><article key={p.id}><b>{p.colaborador}</b> · {p.periodo}<p>{p.funcao} · {money(p.valor_bruto)} · {p.status}</p></article>)}</div></>}
  </section>;
}
