// Read-only, provenance-labelled dashboard. No DRE, bank or certified closeout inference.
import {calculateWorkProgress} from './workProgress.js';
const records=(row,key)=>Array.isArray(row?.[key])?row[key]:[];
const finite=(value,label)=>{const n=Number(value??0);if(!Number.isFinite(n)||n<0)throw Error('Dado inválido em '+label);return n;};
const sum=(rows,f)=>rows.reduce((s,row)=>s+f(row),0);
export function buildWorkCloseout(work={},links={}){
 const etapas=records(work,'etapas'),rdos=records(work,'rdos'),pendencias=records(work,'pendencias'),medicoes=records(work,'medicoes'),compras=records(work,'compras'),materiais=records(work,'materiais'),documentos=records(work,'documentos');
 const {value:progress,method:basis}=calculateWorkProgress(etapas);
 const openIssues=pendencias.filter(p=>p.status!=='resolvida').length;
 const approvedRdoCount=rdos.filter(r=>r.status_aprovacao==='aprovado').length;
 const draftRdoCount=rdos.length-approvedRdoCount;
 const approvedMeasures=medicoes.filter(m=>m.status==='aprovada');
 const unapprovedMeasures=medicoes.length-approvedMeasures.length;
 const approvedMeasurementValue=sum(approvedMeasures,m=>finite(m.quantidade,'quantidade medida')*finite(m.preco_unitario,'preço de medição'));
 const registeredMaterialCost=sum(materiais,m=>finite(m.quantidade_realizada,'quantidade de material')*finite(m.custo_unitario,'preço unitário de material'));
 const pendingReceiptCount=compras.filter(c=>finite(c.recebido,'recebimento')<finite(c.quantidade,'quantidade comprada')).length;
 const pendingPaymentCount=compras.filter(c=>c.pagamento_status!=='pago').length;
 const blockers=[];
 if(!etapas.length)blockers.push('Etapas de execução não cadastradas');
 else if(etapas.some(e=>finite(e.percentual_concluido,'avanço da etapa')<100))blockers.push('Há etapas com execução inferior a 100%');
 if(openIssues)blockers.push(openIssues+' pendência(s) abertas');
 if(!approvedRdoCount)blockers.push('Nenhum RDO aprovado');
 if(draftRdoCount)blockers.push(draftRdoCount+' RDO(s) sem aprovação');
 if(unapprovedMeasures)blockers.push(unapprovedMeasures+' medição(ões) operacionais sem aprovação');
 if(pendingReceiptCount)blockers.push(pendingReceiptCount+' pedido(s) com recebimento pendente');
 if(pendingPaymentCount)blockers.push(pendingPaymentCount+' pedido(s) com pagamento não confirmado');
 if(!documentos.length)blockers.push('Não há documentos de obra cadastrados');
 return {
  progress,progressBasis:basis,stages:etapas.length,openIssues,approvedRdoCount,draftRdoCount,
  approvedMeasurementCount:approvedMeasures.length,unapprovedMeasurementCount:unapprovedMeasures,
  approvedMeasurementValue,registeredMaterialCost,pendingReceiptCount,pendingPaymentCount,
  documentCount:documentos.length,studyCount:finite(links.studyCount??0,'estudos BIM'),
  reviewLinkCount:finite(links.reviewLinkCount??0,'revisões CBIM'),
  measureLinkCount:finite(links.measureLinkCount??0,'conciliações de medição'),
  blockers,readyForReview:blockers.length===0,
  caveat:'Indicadores operacionais para conferência humana. Medições aprovadas, custos materiais e compras não são lançamentos bancários nem DRE contábil.'
 };
}
