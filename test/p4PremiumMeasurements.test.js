import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeMeasurementReconciliation,prepareMeasurementLink,MEASUREMENT_LINK} from '../src/domain/p1Traceability.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('P4 measurement UI relies on Python engine and complete QTO',()=>{
 const w=read('../app/src/react/shell/Measurement5DWorkspace.tsx');
 const shell=read('../app/src/react/shell/Bim4D5DPanel.tsx');
 assert.match(shell,/<Measurement5DWorkspace/);assert.match(shell,/import \{EngineeringFeedback\}/);
 for(const text of ['guid_lookup','quantity_records',"onAction('measure'","onQuery('finance'","Confirmar decisão"])assert.ok(w.includes(text));
 assert.doesNotMatch(w,/slice\(0,300\)/);
});
test('P4 reconciliation is only permitted with approved same-competence same-unit sources',()=>{
 const project={id:'study',obra_id:'work'};
 const batch={batch_id:'B',period:'2026-10',status:'approved',approved_at:'2026-10-13',lines:[{global_id:'GUID-1',unit:'m',delta_quantity:3}]};
 const op={id:'O',obra_id:'work',periodo:'2026-10',unidade:'m',status:'aprovada',quantidade:4,preco_unitario:10};
 const link=prepareMeasurementLink(project,batch,op,[],'Responsável');
 assert.equal(link.moduleId,MEASUREMENT_LINK);
 const rows=[{module_id:MEASUREMENT_LINK,obra_id:'work',entity_id:'B',source:link.source}];
 assert.equal(summarizeMeasurementReconciliation(project,[batch],[op],rows)[0].delta,-1);
 assert.throws(()=>prepareMeasurementLink(project,batch,op,rows,'Responsável'),/duplicada/);
 assert.throws(()=>prepareMeasurementLink(project,batch,{...op,unidade:'m²'},[],'Responsável'),/unidade/);
});
test('P4 writes reconciliation link and history atomically',()=>{
 const store=read('../storage/sqliteStore.js'),panel=read('../app/src/react/shell/BimMeasurementReconciliationPanel.tsx');
 assert.match(store,/export function registrarConferenciaMedicaoAtomica/);
 assert.match(store,/BEGIN IMMEDIATE/);assert.match(store,/ROLLBACK/);
 assert.match(store,/registrarHistorico\(db,dados.obraId,'conciliacao_medicao'/);
 assert.match(panel,/registrarConferenciaMedicaoAtomica/);assert.doesNotMatch(panel,/salvarModuleLink/);
});
