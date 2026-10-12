import test from 'node:test';
import assert from 'node:assert/strict';
import { filterScopedRecords, financialScopeRows, validateWorkspacePeriod } from '../src/domain/workspaceScope.js';
import { reconciliarFinanceiroObra } from '../src/domain/financialReconciliation.js';

test('P0 scope respects front and inclusive day boundaries without changing source rows', () => {
 const rows=[
  {id:'a',frente_id:'F1',data:'2026-10-01'},
  {id:'b',frente_id:'F1',data:'2026-10-31'},
  {id:'c',frente_id:'F2',data:'2026-10-12'},
  {id:'d',frente_id:'F1',data:'2026-11-01'},
  {id:'e',frente_id:'F1',data:null}
 ];
 const scope={frenteId:'F1',periodo:{inicio:'2026-10-01',fim:'2026-10-31'}};
 assert.deepEqual(filterScopedRecords(rows,scope,{frontField:'frente_id',dateField:'data'}).map(x=>x.id),['a','b']);
 assert.equal(rows.length,5);
});
test('P0 monthly competencies overlap calendar day filters', () => {
 const rows=[{periodo:'2026-09'},{periodo:'2026-10'},{periodo:'2026-11'}];
 assert.deepEqual(filterScopedRecords(rows,{periodo:{inicio:'2026-10-15',fim:'2026-11-02'}},{dateField:'periodo'}).map(x=>x.periodo),['2026-10','2026-11']);
});
test('P0 contract intervals overlap the selected period', () => {
 const rows=[{id:1,inicio:'2026-09-01',fim:'2026-10-16'},{id:2,inicio:'2026-11-01',fim:'2027-01-01'}];
 assert.deepEqual(filterScopedRecords(rows,{periodo:{inicio:'2026-10-15',fim:'2026-10-31'}},{intervalStartField:'inicio',intervalEndField:'fim'}).map(x=>x.id),[1]);
});
test('P0 unsupported front filters never show unscoped records as scoped', () => {
 const records=[{id:1,data:'2026-10-12'}];
 assert.deepEqual(filterScopedRecords(records,{frenteId:'F1'}, {dateField:'data'}),[]);
 assert.deepEqual(filterScopedRecords(records,{}, {dateField:'data'}),records);
});
test('P0 finance keeps global entries distinct from selected work and filters by due date', () => {
 const rows=[
  {id:'w',obra_id:'W',vencimento:'2026-10-12',valor:100},
  {id:'global',obra_id:null,vencimento:'2026-10-12',valor:300},
  {id:'other',obra_id:'X',vencimento:'2026-10-12',valor:200},
  {id:'old',obra_id:'W',vencimento:'2026-09-30',valor:900}
 ];
 const scope={obraId:'W',periodo:{inicio:'2026-10-01',fim:'2026-10-31'}};
 const result=financialScopeRows(rows,scope);
 assert.deepEqual(result.rows.map(x=>x.id),['w']);
 assert.deepEqual(result.unallocated.map(x=>x.id),['global']);
 assert.deepEqual(financialScopeRows(rows,{...scope,frenteId:'F1'}).rows,[]);
 assert.equal(financialScopeRows(rows,{obraId:null}).rows.length,4);
});
test('P0 global financial reconciliation includes all works without attributing to any individual work', () => {
 const entries=[
  {obra_id:'W',tipo:'receita',status:'recebido',valor:80},
  {obra_id:'X',tipo:'receita',status:'recebido',valor:20},
  {obra_id:null,tipo:'despesa',status:'pago',valor:40}
 ];
 assert.equal(reconciliarFinanceiroObra({obraId:null,entries}).saldoCaixaRegistrado,60);
 assert.equal(reconciliarFinanceiroObra({obraId:'W',entries}).saldoCaixaRegistrado,80);
});
test('P0 inverted time ranges are refused before writing workspace context', () => {
 assert.throws(()=>validateWorkspacePeriod({inicio:'2026-11-01',fim:'2026-10-01'}),/período/i);
 assert.doesNotThrow(()=>validateWorkspacePeriod({inicio:'2026-10-01',fim:'2026-10-01'}));
});
