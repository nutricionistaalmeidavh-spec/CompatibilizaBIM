import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REVIEW_LINK, MEASUREMENT_LINK, MATERIAL_LINK, FINANCE_LINK,
  prepareReviewLink,prepareMeasurementLink,prepareMaterialLink,parseTraceLink,
  summarizeMeasurementReconciliation,summarizePurchaseMaterialTrace,preparePurchaseFinanceLink,summarizePurchaseFinanceTrace,assertStudyWorkAssociation,
} from '../src/domain/p1Traceability.js';

const project={id:'S1',nome:'Projeto BIM',obra_id:'OBRA-1'};
const workspace={path:'/local/CBIM/jobs/job-1/studio-workspace',job:'job-1',project_id:'cbim-unique',project_name:'Conversão CAD',revision:3,updated_at:'2026-10-12T10:00:00Z'};
const approved={batch_id:'MED-A',period:'2026-10',status:'approved',approved_at:'2026-10-12T12:00:00Z',lines:[
  {global_id:'IFC-G1',kind:'length',quantity_name:'Length',unit:'m',delta_quantity:2},
  {global_id:'IFC-G2',kind:'length',quantity_name:'Length',unit:'m',delta_quantity:3}
]};
const operation={id:'OP-1',obra_id:'OBRA-1',status:'aprovada',periodo:'2026-10',unidade:'m',quantidade:4,preco_unitario:50};

test('P1 review provenance records origin, workspace path, CBIM identity and revision without modifying model',()=>{
 const result=prepareReviewLink(project,workspace,[]);
 assert.equal(result.moduleId,REVIEW_LINK);
 assert.equal(result.entityId,'S1');
 assert.equal(result.obraId,'OBRA-1');
 const loaded=parseTraceLink({module_id:REVIEW_LINK,entity_id:'S1',obra_id:'OBRA-1',source:result.source});
 assert.deepEqual({cbimId:loaded.cbimProjectId,revision:loaded.revision,job:loaded.job,path:loaded.workspacePath},{cbimId:'cbim-unique',revision:3,job:'job-1',path:workspace.path});
});
test('P1 reject assigning same review workspace to two different studies',()=>{
 const first=prepareReviewLink(project,workspace,[]);
 assert.throws(()=>prepareReviewLink({id:'S2',obra_id:null},workspace,[{module_id:REVIEW_LINK,entity_id:'S1',source:first.source}]),/já vinculado/i);
});
test('P1 reject empty or invalid review source, and a stale revision update',()=>{
 assert.throws(()=>prepareReviewLink(project,{...workspace,path:'../x'},[]),/workspace/i);
 const link=prepareReviewLink(project,workspace,[]);
 assert.throws(()=>prepareReviewLink(project,{...workspace,revision:2},[{module_id:REVIEW_LINK,entity_id:'S1',source:link.source}]),/versão anterior/i);
 assert.equal(parseTraceLink({module_id:REVIEW_LINK,source:'{bad'}),null);
});

test('P1 manual measurement reconciliation requires approved records, work identity, unit and competence',()=>{
 const data=prepareMeasurementLink(project,approved,operation,[],'Eng. Responsável');
 assert.equal(data.moduleId,MEASUREMENT_LINK);
 assert.equal(data.entityId,'MED-A');
 const link=parseTraceLink({module_id:MEASUREMENT_LINK,entity_id:data.entityId,obra_id:data.obraId,source:data.source});
 assert.equal(link.operationalId,'OP-1');
 assert.equal(link.projectId,'S1');
 assert.deepEqual(link.guids,['IFC-G1','IFC-G2']);
 assert.throws(()=>prepareMeasurementLink(project,{...approved,status:'draft'},operation,[],'Pessoa'),/aprovada/i);
 assert.throws(()=>prepareMeasurementLink(project,approved,{...operation,unidade:'un'},[],'Pessoa'),/unidade/i);
 assert.throws(()=>prepareMeasurementLink(project,approved,{...operation,periodo:'2026-09'},[],'Pessoa'),/competência/i);
 assert.throws(()=>prepareMeasurementLink(project,approved,{...operation,obra_id:'OBRA-2'},[],'Pessoa'),/obra/i);
 assert.throws(()=>prepareMeasurementLink(project,approved,operation,[],''),/responsável/i);
});
test('P1 prevents reusing a BIM batch or operational measure across two links (double-count safeguard)',()=>{
 const link=prepareMeasurementLink(project,approved,operation,[],'Pessoa');
 const row={module_id:MEASUREMENT_LINK,entity_id:'MED-A',obra_id:'OBRA-1',source:link.source};
 assert.throws(()=>prepareMeasurementLink(project,approved,{...operation,id:'OP-2'},[row],'Pessoa'),/já conciliada/i);
 assert.throws(()=>prepareMeasurementLink(project,{...approved,batch_id:'MED-B'},operation,[row],'Pessoa'),/já conciliada/i);
});
test('P1 summaries compare same-unit approved quantities, do not total BIM with operational money',()=>{
 const link=prepareMeasurementLink(project,approved,operation,[],'Pessoa');
 const result=summarizeMeasurementReconciliation(project,[approved],[operation],[{module_id:MEASUREMENT_LINK,entity_id:link.entityId,source:link.source}]);
 assert.equal(result.length,1);
 assert.equal(result[0].state,'divergente');
 assert.equal(result[0].bimQuantity,5);
 assert.equal(result[0].operationalQuantity,4);
 assert.equal(result[0].delta,1);
 assert.equal(result[0].operationalValue,200);
 assert.ok(!('consolidatedValue' in result[0]));
 assert.equal(summarizeMeasurementReconciliation(project,[{...approved,status:'draft'}],[operation],[]).length,0);
});
test('P1 purchase material association is explicit, same work and unit, with no payment or stock changes',()=>{
 const purchase={id:'C1',obra_id:'OBRA-1',unidade:'m',quantidade:10,recebido:6,valor_total:400,pagamento_status:'pago'};
 const material={id:'MAT-1',obra_id:'OBRA-1',unidade:'m',material:'Tubo 50 mm',quantidade_realizada:3,custo_unitario:40};
 const link=prepareMaterialLink('OBRA-1',purchase,material,[],'Fiscal de obra');
 assert.equal(link.moduleId,MATERIAL_LINK);
 const result=summarizePurchaseMaterialTrace([purchase],[material],[{module_id:MATERIAL_LINK,entity_id:link.entityId,source:link.source}]);
 assert.equal(result[0].receivedQuantity,6);
 assert.equal(result[0].registeredConsumption,3);
 assert.equal(result[0].pendingReceipt,4);
 assert.equal(result[0].paymentStatus,'pago');
 assert.ok(!('autoPostedAmount' in result[0]));
 assert.throws(()=>prepareMaterialLink('OBRA-1',purchase,{...material,unidade:'kg'},[],'Pessoa'),/unidade/i);
 assert.throws(()=>prepareMaterialLink('OBRA-1',purchase,{...material,obra_id:'OBRA-2'},[],'Pessoa'),/obra/i);
});

test('P1 purchasing financial trace is reference-only, validates work and expense type, and detects mismatched money',()=>{
 const purchase={id:'BUY-A',obra_id:'OBRA-1',valor_total:120,quantidade:1,recebido:1,unidade:'un',pagamento_status:'pago'};
 const entry={id:'LED-A',obra_id:'OBRA-1',tipo:'despesa',valor:100,status:'previsto'};
 const link=preparePurchaseFinanceLink('OBRA-1',purchase,entry,[],'Conferente');
 assert.equal(link.moduleId,FINANCE_LINK);
 const references=[{module_id:FINANCE_LINK,entity_id:'BUY-A',source:link.source}];
 const result=summarizePurchaseFinanceTrace([purchase],[entry],references)[0];
 assert.equal(result.purchaseAmount,120);
 assert.equal(result.recordedExpenseAmount,100);
 assert.equal(result.delta,20);
 assert.equal(result.state,'divergente');
 assert.equal(result.paymentStatus,'pago');
 assert.equal(result.ledgerStatus,'previsto');
 assert.ok(!('postedTransaction' in result));
 assert.throws(()=>preparePurchaseFinanceLink('OBRA-1',purchase,{...entry,tipo:'receita'},[],'Conferente'),/despesa/i);
 assert.throws(()=>preparePurchaseFinanceLink('OBRA-1',purchase,{...entry,obra_id:null},[],'Conferente'),/obra/i);
 assert.throws(()=>preparePurchaseFinanceLink('OBRA-1',purchase,entry,references,'Conferente'),/já vincula/i);
});
test('P1 purchasing reference cannot reuse the same expense on another purchase',()=>{
 const p={id:'P1',obra_id:'OBRA-1',valor_total:10};
 const e={id:'E1',obra_id:'OBRA-1',tipo:'despesa',valor:10,status:'pago'};
 const l=preparePurchaseFinanceLink('OBRA-1',p,e,[],'Técnico');
 assert.throws(()=>preparePurchaseFinanceLink('OBRA-1',{...p,id:'P2'},e,[{module_id:FINANCE_LINK,entity_id:l.entityId,source:l.source}],'Técnico'),/já vincula/i);
});

test('P1 supports deliberate association of an independent study with an existing work, never silently reassigns',()=>{
 assert.equal(assertStudyWorkAssociation({id:'S1',obra_id:null},'OBRA-1'),true);
 assert.equal(assertStudyWorkAssociation({id:'S1',obra_id:'OBRA-1'},'OBRA-1'),false);
 assert.throws(()=>assertStudyWorkAssociation({id:'S1',obra_id:'OBRA-2'},'OBRA-1'),/outra obra/i);
 assert.throws(()=>assertStudyWorkAssociation(null,'OBRA-1'),/estudo/i);
 assert.throws(()=>assertStudyWorkAssociation({id:'S1',obra_id:null},''),/obra/i);
});
