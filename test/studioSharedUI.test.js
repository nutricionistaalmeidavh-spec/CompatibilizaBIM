import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WORK_FIELDS,FRONT_FIELDS,SUBFRONT_FIELDS,CHECKLIST_FIELDS,
 validateStudioFields,studioBreadcrumbs} from '../src/ui/studioPresentation.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('shared native-form specifications preserve original canonical FormData names',()=>{
 assert.deepEqual(WORK_FIELDS.map(x=>x.name),['codigo','nome','cliente','endereco','responsavel']);
 assert.deepEqual(FRONT_FIELDS.map(x=>x.name),['nome','responsavel']);
 assert.deepEqual(SUBFRONT_FIELDS.map(x=>x.name),['nome','descricao']);
 assert.deepEqual(CHECKLIST_FIELDS.map(x=>x.name),['descricao','responsavel']);
 for(const fields of [WORK_FIELDS,FRONT_FIELDS,SUBFRONT_FIELDS,CHECKLIST_FIELDS])assert.equal(validateStudioFields(fields),fields);
});

test('invalid repeated or unsupported form metadata never gets silently rendered',()=>{
 assert.throws(()=>validateStudioFields([{name:'nome',label:'Nome'},{name:'nome',label:'Nome duplicado'}]),/duplicado/);
 assert.throws(()=>validateStudioFields([{name:'valor',label:'Valor',type:'unknown'}]),/não suportado/);
 assert.throws(()=>validateStudioFields([{name:'categoria',label:'Categoria',type:'select'}]),/sem opções/);
});

test('contextual navigation does not falsely attach an independent study to a selected work',()=>{
 assert.deepEqual(studioBreadcrumbs({route:'BIM',work:{id:'w1',nome:'Obra A'},study:{id:'b1',nome:'Projeto independente',obra_id:null}}).map(x=>x.label),
 ['Obras','Estudo independente','BIM','Projeto independente']);
 assert.deepEqual(studioBreadcrumbs({route:'Operação',work:{id:'w1',nome:'Obra A'}}).map(x=>x.label),
 ['Obras','Obra A','Operação']);
 assert.deepEqual(studioBreadcrumbs({route:'BIM',work:{id:'w1',nome:'Obra A'},study:{id:'b1',nome:'Projeto ligado',obra_id:'w1'}}).map(x=>x.label),
 ['Obras','Obra A','BIM','Projeto ligado']);
});

test('reusable components contain the predictable UI and recovery contracts',()=>{
 const ui=read('app/src/react/components/EngineeringUI.tsx');
 assert.match(ui,/export function SchemaFields/);
 assert.match(ui,/export function EngineeringTable/);
 assert.match(ui,/export function EngineeringBreadcrumbs/);
 assert.match(ui,/export function EngineeringFeedback/);
 assert.match(ui,/export function EngineeringConfirmDialog/);
 assert.match(ui,/aria-modal="true"/);
 assert.match(ui,/typedPhrase/);
 assert.match(ui,/e\.key==='Escape'/);
 assert.match(ui,/aria-busy=\{busy\}/);
});

test('real flows reuse shared components without introducing second backend',()=>{
 const works=read('app/src/react/shell/WorksPage.tsx');
 const ops=read('app/src/react/shell/OperationsPage.tsx');
 const rdo=read('app/src/react/shell/RdoPage.tsx');
 const shell=read('app/src/react/shell/AppShell.tsx');
 assert.match(works,/<SchemaFields fields=\{WORK_FIELDS\}/);
 assert.match(ops,/<EngineeringTable/);
 assert.match(ops,/<SchemaFields fields=\{FRONT_FIELDS\}/);
 assert.match(ops,/<EngineeringConfirmDialog/);
 assert.match(rdo,/<EngineeringConfirmDialog/);
 assert.match(shell,/<EngineeringBreadcrumbs/);
 assert.match(shell,/<EngineeringConfirmDialog/);
 assert.doesNotMatch(shell,/window\.confirm/);
 assert.doesNotMatch(rdo,/window\.prompt/);
});

test('motion respects OS reduced-motion preference',()=>{
 const css=read('app/src/react/components/engineering-ui.css');
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/cbim-route-appear/);
});

test('real BIM fixture is imported before the canonical calculation-to-model scenario',()=>{
  const smoke=read('scripts/qa/reactBrowserSmoke.cjs');
  assert.ok(smoke.indexOf("getByLabel('Importar IFC / CBIM JSON').setInputFiles")>0);
  assert.ok(smoke.indexOf("getByLabel('Importar IFC / CBIM JSON').setInputFiles")<
    smoke.indexOf("getByLabel('Modelo de origem').selectOption"));
  assert.match(smoke,/G-QA-001/);
});
