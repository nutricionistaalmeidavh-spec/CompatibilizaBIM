import React from 'react';
import {engineeringNumber} from '../../../../src/domain/engineeringPresentation.js';

type PortfolioProps={
  works:any[];obraId:string|null;selectWork:(id:string|null)=>void;
  onNewWork:()=>void;newWork:boolean;onNavigate?:(route:string)=>void
};
const normalize=(s:any)=>String(s||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_');
const group=(status:any)=>{
 const key=normalize(status);
 if(['concluida','concluido','encerrada','finalizada','entregue'].includes(key))return 'concluidas';
 if(['planejamento','projeto','projetos','planejada'].includes(key))return 'planejamento';
 if(['em_andamento','execucao','ativa','ativo','em_execucao'].includes(key))return 'andamento';
 return 'outras';
};
const stamp=(value:any)=>{
 if(!value)return '—';
 const date=new Date(String(value));
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(date);
};
const percent=(w:any)=>Math.min(100,Math.max(0,Number(w.percentual_concluido)||0));
export function WorkPortfolio({works,obraId,selectWork,onNewWork,newWork,onNavigate}:PortfolioProps){
 const [query,setQuery]=React.useState('');
 const [filter,setFilter]=React.useState('todas');
 const [page,setPage]=React.useState(1);
 const [pageSize,setPageSize]=React.useState(8);
 const [sort,setSort]=React.useState('recentes');
 const pending=works.reduce((count,w)=>count+Number(w.pendencias_abertas||0),0);
 const rdos=works.reduce((count,w)=>count+Number(w.rdos_total||0),0);
 const average=works.length?works.reduce((count,w)=>count+percent(w),0)/works.length:0;
 const tabs=[
  {key:'todas',label:'Todas as obras',count:works.length},
  {key:'andamento',label:'Em andamento',count:works.filter(w=>group(w.status)==='andamento').length},
  {key:'concluidas',label:'Concluídas',count:works.filter(w=>group(w.status)==='concluidas').length},
  {key:'planejamento',label:'Planejamento',count:works.filter(w=>group(w.status)==='planejamento').length},
  ...((works.some(w=>group(w.status)==='outras'))?[{key:'outras',label:'Outras',count:works.filter(w=>group(w.status)==='outras').length}]:[])
 ];
 const term=query.trim().toLocaleLowerCase('pt-BR');
 const filtered=works.filter(w=>(filter==='todas'||group(w.status)===filter)&&
  (!term||[w.nome,w.codigo,w.cliente,w.endereco,w.responsavel_tecnico].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(term))));
 const sorted=[...filtered].sort((a,b)=>sort==='nome'?String(a.nome).localeCompare(String(b.nome),'pt-BR'):
   sort==='progresso'?percent(b)-percent(a):
   String(b.atualizado_em||'').localeCompare(String(a.atualizado_em||'')));
 const pages=Math.max(1,Math.ceil(sorted.length/pageSize));
 const current=Math.min(page,pages);
 const visible=sorted.slice((current-1)*pageSize,current*pageSize);
 const selectFilter=(key:string)=>{setFilter(key);setPage(1);};
 return <div className="cbim-portfolio" data-testid="cbim-works-portfolio">
   <div className="cbim-portfolio-heading"><div>
     <span className="cbim-portfolio-overline">OBRAS / PORTFÓLIO</span>
     <h1>Carteira de obras</h1>
     <p>Gestão integrada dos projetos e registros técnicos da sua carteira local.</p>
   </div><button type="button" className="cbim-portfolio-primary" onClick={onNewWork}>{newWork?'Cancelar':'+ Nova obra'}</button></div>
   <div className="cbim-portfolio-kpis" aria-label="Indicadores reais da carteira">
     <article className="cbim-portfolio-kpi"><span className="cbim-portfolio-kpi-icon blue" aria-hidden="true">▥</span><div><span>Obras</span><strong>{works.length}</strong><small>Total cadastradas no SQLite</small></div></article>
     <article className="cbim-portfolio-kpi"><span className="cbim-portfolio-kpi-icon green" aria-hidden="true">▰</span><div><span>Avanço médio</span><strong>{engineeringNumber(average)}%</strong><small>Média calculada das obras</small></div></article>
     <article className="cbim-portfolio-kpi"><span className="cbim-portfolio-kpi-icon purple" aria-hidden="true">▤</span><div><span>RDOs</span><strong>{rdos}</strong><small>Registros na carteira</small></div></article>
     <article className="cbim-portfolio-kpi"><span className="cbim-portfolio-kpi-icon red" aria-hidden="true">!</span><div><span>Pendências abertas</span><strong>{pending}</strong><small>Todas as obras</small></div></article>
   </div>
   <section className="cbim-portfolio-surface" aria-label="Lista de obras">
     <div className="cbim-portfolio-actions">
       <div className="cbim-portfolio-filters" role="group" aria-label="Filtrar obras por etapa">
         {tabs.map(t=><button key={t.key} type="button" aria-pressed={filter===t.key} className={filter===t.key?'is-active':''} onClick={()=>selectFilter(t.key)}>{t.label}<span>{t.count}</span></button>)}
       </div>
       <div className="cbim-portfolio-search">
         <label className="cbim-portfolio-search-field"><span className="cbim-sr-only">Buscar obras</span><input aria-label="Buscar obras" placeholder="Buscar obra, código, cliente..." type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label>
         <label className="cbim-portfolio-sort">Ordenar <select aria-label="Ordenar obras" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="recentes">Recentes</option><option value="nome">Nome</option><option value="progresso">Avanço</option></select></label>
       </div>
     </div>
     <div className="cbim-portfolio-scroll"><table className="cbim-portfolio-table" aria-label="Carteira de obras — registros canônicos"><thead><tr>
       <th>Obra</th><th>Cliente</th><th>Localização</th><th>Status</th><th>Avanço</th><th>RDOs</th><th>Pendências</th><th>Atualizada</th><th>Ação</th>
     </tr></thead><tbody>
       {visible.map(w=><tr key={w.id} className={obraId===w.id?'is-selected':''}>
         <td><div className="cbim-portfolio-work"><span className="cbim-portfolio-work-icon" aria-hidden="true">▥</span><div><b>{w.nome}</b><small>{w.codigo}</small></div></div></td>
         <td>{w.cliente||'—'}</td><td>{w.endereco||'—'}</td>
         <td><span className={'cbim-portfolio-status '+group(w.status)}>{w.status||'Não informado'}</span></td>
         <td><div className="cbim-portfolio-progress"><div className="cbim-portfolio-track" role="progressbar" aria-label={'Avanço de '+w.nome} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(w)}><span style={{width:percent(w)+'%'}}/></div><strong>{engineeringNumber(percent(w))}%</strong></div><small className="cbim-portfolio-progress-source">{w.progresso_metodo||'Avanço canônico'}</small></td>
         <td className="cbim-portfolio-number">{Number(w.rdos_total||0)}</td>
         <td><span className={'cbim-portfolio-pending '+(Number(w.pendencias_abertas||0)>0?'has-pending':'')}>{Number(w.pendencias_abertas||0)}</span></td>
         <td><time dateTime={w.atualizado_em||undefined}>{stamp(w.atualizado_em)}</time></td>
         <td><button type="button" className="cbim-portfolio-open" aria-label={'Abrir obra '+w.nome} onClick={()=>selectWork(w.id)}>{obraId===w.id?'Selecionada':'Abrir'}</button></td>
       </tr>)}
       {visible.length===0&&<tr><td colSpan={9} className="cbim-portfolio-empty">{works.length===0?'Nenhuma obra cadastrada. Comece em “Nova obra”.':'Nenhuma obra corresponde aos filtros ou à pesquisa.'}</td></tr>}
     </tbody></table></div>
     <footer className="cbim-portfolio-pagination"><span>Exibindo {visible.length?((current-1)*pageSize+1):0}–{Math.min(current*pageSize,sorted.length)} de {sorted.length} obras</span>
       <div><button type="button" aria-label="Página anterior de obras" disabled={current===1} onClick={()=>setPage(x=>Math.max(1,x-1))}>‹</button><span>Página {current} de {pages}</span><button type="button" aria-label="Próxima página de obras" disabled={current>=pages} onClick={()=>setPage(x=>Math.min(pages,x+1))}>›</button>
         <label>Itens por página <select aria-label="Obras por página" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}><option value={8}>8</option><option value={16}>16</option><option value={32}>32</option></select></label>
       </div>
     </footer>
   </section>
   {obraId&&<p className="cbim-portfolio-selection"><strong>Obra selecionada:</strong> consulte o painel técnico, registros e histórico abaixo. {onNavigate&&<button type="button" onClick={()=>onNavigate('BIM')}>Abrir BIM da obra →</button>}</p>}
 </div>;
}
