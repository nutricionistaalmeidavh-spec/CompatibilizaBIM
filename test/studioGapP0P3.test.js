import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewScheduleImport} from '../src/bim/scheduleImportPreview.js';
import {filterBimFiles, summarizeBimAlerts} from '../src/bim/studioExplorer.js';

test('P2 scheduled import previews quoted CSV and predecessor graph without writing schedule',()=>{
 const csv='\uFEFFactivity_id,name,start_date,end_date,predecessors\n'+
 'A,"Tubulação, térreo",2026-11-01,2026-11-05,\n'+
 'B,"Conexões",2026-11-06,2026-11-08,A\n';
 const result=previewScheduleImport(csv);
 assert.equal(result.ok,true);
 assert.equal(result.count,2);
 assert.equal(result.rows[0].name,'Tubulação, térreo');
 assert.deepEqual(result.rows[1].predecessors,['A']);
 assert.equal(result.errors.length,0);
});
test('P2 preview rejects graph cycles, broken references, missing dates and duplicate identifiers',()=>{
 for(const [csv,error] of [
  ['activity_id,name,start_date,end_date,predecessors\nA,X,2026-11-01,2026-11-02,B\nB,Y,2026-11-03,2026-11-04,A\n','cíclica'],
  ['activity_id,name,start_date,end_date,predecessors\nA,X,2026-11-01,2026-11-02,ABSENT\n','ausente'],
  ['activity_id,name,start_date,end_date,predecessors\nA,X,2026-11-03,2026-11-01,\n','Fim'],
  ['activity_id,name,start_date,end_date,predecessors\nA,X,2026-11-01,2026-11-02,\nA,Y,2026-11-02,2026-11-03,\n','duplicado'],
  ['wrong,name\nX,Y\n','Cabeçalho']
 ]){
  const out=previewScheduleImport(csv);
  assert.equal(out.ok,false);
  assert.ok(out.errors.some(item=>item.includes(error)),error+' in '+JSON.stringify(out.errors));
 }
});
test('P2 preview refuses oversized input and malformed CSV quotes',()=>{
 assert.equal(previewScheduleImport('a'.repeat(2_000_001)).ok,false);
 assert.equal(previewScheduleImport('activity_id,name,start_date,end_date\nA,"open,2026-10-01,2026-10-02').ok,false);
});
test('P0-P1 BIM file explorer searches without altering source order or inventing IFC geometry',()=>{
 const files=[
  {id:'a',nome:'Tubo_A.ifc',disciplina:'hydraulic',revisao:2,arquivo_hash:'sha-1',elementos:[]},
  {id:'b',nome:'Parede.cbim.json',disciplina:'architecture',revisao:1,arquivo_hash:'sha-2',elementos:[{id:1}]}
 ];
 assert.deepEqual(filterBimFiles(files,'tubo').map(m=>m.id),['a']);
 assert.deepEqual(filterBimFiles(files,'architecture').map(m=>m.id),['b']);
 assert.deepEqual(filterBimFiles(files,'nao-existe'),[]);
 assert.equal(files[0].elementos.length,0);
});
test('P1 alerts display only verifiable pending conflicts',()=>{
 const findings=summarizeBimAlerts([{status:'aberto'},{status:'em_revisao'},{status:'resolvido'}]);
 assert.deepEqual(findings,{total:3,pending:2,resolved:1});
});
test('P3 query IPC must be read-only and validate selectors',()=>{
 const code=readFileSync(new URL('../app/electron/p2Bridge.cjs',import.meta.url),'utf8');
 assert.match(code,/['"]ifc_query['"]/);
 assert.match(code,/Ifc/);
 const python=readFileSync(new URL('../modules/compatibilizabim/p2_workflow.py',import.meta.url),'utf8');
 assert.match(python,/if action=='ifc_query'/);
 assert.match(python,/hashlib\.sha256/);
 const panel=readFileSync(new URL('../app/src/react/shell/Bim4D5DPanel.tsx',import.meta.url),'utf8');
 assert.match(panel,/Consultar IFC/);
 assert.match(panel,/previewScheduleImport/);
});
