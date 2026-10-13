'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {validateP2Request}=require('../app/electron/p2Bridge.cjs');
test('P3 IPC validates mutation and full IFC lookup selectors before Python',()=>{
 assert.equal(validateP2Request({projectId:'study-a',action:'reschedule',params:{
  activity_id:'A',start_date:'2026-10-01',end_date:'2026-10-03',predecessors:[]}}).action,'reschedule');
 assert.throws(()=>validateP2Request({projectId:'study-a',action:'reschedule',params:{
  activity_id:'A',start_date:'../etc',end_date:'2026-10-03'}}),/Datas/);
 assert.equal(validateP2Request({projectId:'study-a',action:'guid_lookup',params:{search:'PIPE',offset:850,limit:40}}).action,'guid_lookup');
 assert.throws(()=>validateP2Request({projectId:'study-a',action:'guid_lookup',params:{search:'A'}}),/2/);
 assert.throws(()=>validateP2Request({projectId:'study-a',action:'guid_lookup',params:{search:'GUID',limit:500}}),/Limite/);
});
test('P3 Gantt edits require confirmation and reuse the canonical schedule engine',()=>{
 const panel=fs.readFileSync(require('node:path').join(__dirname,'../app/src/react/shell/Bim4D5DPanel.tsx'),'utf8');
 const gantt=fs.readFileSync(require('node:path').join(__dirname,'../app/src/react/shell/CanonicalGantt.tsx'),'utf8');
 const workspace=fs.readFileSync(require('node:path').join(__dirname,'../app/src/react/shell/Schedule4DWorkspace.tsx'),'utf8');
 assert.match(panel,/<SchedulePreview/);
 assert.match(panel,/<Schedule4DWorkspace/);
 assert.match(workspace,/onAction\('reschedule'/);
 assert.match(workspace,/onAction\('progress'/);
 assert.match(workspace,/guid_lookup/);
 assert.match(workspace,/Confirmar alteração/);
 assert.match(workspace,/setResetKey/);
 assert.match(gantt,/on_date_change/);
 assert.match(gantt,/on_progress_change/);
 assert.match(gantt,/readonly_dates:!editable/);
});
