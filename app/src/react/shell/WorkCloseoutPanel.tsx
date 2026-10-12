import React from 'react';
import {buildWorkCloseout} from '../../../../src/domain/workCloseout.js';
import {listarProjetosBim,listarModuleLinks} from '../../../../storage/sqliteStore.js';
import {REVIEW_LINK,MEASUREMENT_LINK} from '../../../../src/domain/p1Traceability.js';
import {Card,Status,EmptyState,Metric} from '../components/ui';
type Props={db:any;work:any;onNavigate?:(route:string)=>void};
const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
export function WorkCloseoutPanel({db,work,onNavigate}:Props){
 const studies=listarProjetosBim(db).filter((study:any)=>study.obra_id===work.id);
 const links=listarModuleLinks(db,work.id);
 const data=buildWorkCloseout(work,{
  studyCount:studies.length,reviewLinkCount:links.filter((x:any)=>x.module_id===REVIEW_LINK).length,
  measureLinkCount:links.filter((x:any)=>x.module_id===MEASUREMENT_LINK).length
 });
 return <section aria-label="Conferência para encerramento de obra" className="cbim-closeout" data-testid="work-closeout">
  <div className="cbim-closeout-heading"><div><h2>Conferência para encerramento</h2><p className="studio-muted">Visão somente de leitura, consolidada a partir dos registros originais da obra. Não altera o status do projeto.</p></div>
    <Status tone={data.readyForReview?'success':'warning'}>{data.readyForReview?'Sem alertas nos critérios operacionais':'Revisão pendente'}</Status>
  </div>
  <div className="cbim-closeout-metrics">
   <Metric label="Avanço das etapas" value={data.progress===null?'Não calculável':data.progress.toLocaleString('pt-BR')+'%'} source={'Etapas · '+data.progressBasis}/>
   <Metric label="Pendências abertas" value={String(data.openIssues)} source="Pendências da obra"/>
   <Metric label="RDOs aprovados" value={String(data.approvedRdoCount)} source={data.draftRdoCount+' não aprovados · Diário de obra'}/>
   <Metric label="Medições aprovadas" value={money(data.approvedMeasurementValue)} source={data.approvedMeasurementCount+' registros · Operação (não é receita recebida)'}/>
   <Metric label="Materiais registrados" value={money(data.registeredMaterialCost)} source="Quantidade realizada × custo unitário cadastrado; não é despesa paga"/>
   <Metric label="Compras a receber" value={String(data.pendingReceiptCount)} source={data.pendingPaymentCount+' com pagamento pendente · Compras'/>
   <Metric label="Documentos" value={String(data.documentCount)} source="Anexos locais da obra"/>
   <Metric label="Estudos BIM vinculados" value={String(data.studyCount)} source={data.reviewLinkCount+' vínculos de revisão · '+data.measureLinkCount+' conferências de medição'}/>
  </div>
  <Card title="Verificações de encerramento">
   {data.blockers.length?<ul className="cbim-closeout-checks">{data.blockers.map(issue=><li key={issue}><Status tone="warning">A conferir</Status><span>{issue}</span></li>)}</ul>:
    <p>Não foram encontrados impedimentos nos critérios operacionais mapeados. A liberação definitiva depende de conferência técnica, contratual e documental.</p>}
   <div className="cbim-react-toolbar">{onNavigate&&<>
     <button type="button" onClick={()=>onNavigate('RDO')}>Revisar RDOs</button>
     <button type="button" onClick={()=>onNavigate('Operação')}>Ver medições e compras</button>
     <button type="button" onClick={()=>onNavigate('Financeiro')}>Ver contas registradas</button>
     <button type="button" onClick={()=>onNavigate('BIM')}>Revisar estudos BIM</button>
   </>}</div>
  </Card>
  <p className="studio-muted">{data.caveat} O progresso e os critérios desta seção abrangem todo o histórico da obra, não apenas o período/frente do cabeçalho.</p>
 </section>;
}
