import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=new URL('../app/',import.meta.url);
const read=(p)=>fs.readFileSync(new URL(p,app),'utf8');
const exists=(p)=>fs.existsSync(new URL(p,app));
test('the shipped desktop has exactly one React entry without Vanilla renderer',()=>{
  assert.match(read('index.html'),/\/src\/react\/main\.tsx/);
  assert.doesNotMatch(read('index.html'),/\/src\/bootstrap\.js|\/src\/main\.js/);
  for(const file of ['src/bootstrap.js','src/rendererMode.js','src/main.js','src/advanced.js','src/bimUi.js','src/standaloneBimUi.js','src/bimEnhancements.js','src/structural3dUi.js','src/react/studio/main.tsx'])assert.equal(exists(file),false,file);
  assert.equal(exists('studio-react.html'),false);
});
test('same React entry selects authenticated review surface and existing workspace renderer',()=>{
  const entry=read('src/react/main.tsx');
  assert.match(entry,/StudioApp/);
  assert.match(entry,/surface/);
  const py=fs.readFileSync(new URL('../integrations/cbim-2.1.0/compatibilizabim-core/src/compatibilizabim_core/desktop/server.py',import.meta.url),'utf8');
  assert.match(py,/ui \/ 'index.html'/);
  const vite=read('vite.config.js');
  assert.doesNotMatch(vite,/studio:\s*resolve\(/);
});
test('React gives access to all local domain operations and exports',()=>{
  const shell=read('src/react/shell/AppShell.tsx');
  for(const entry of ['WorksPage','BimPage','CalculatorsPage','OperationsPage','FinancePage','RdoPage','StructuralPage'])assert.match(shell,new RegExp('<'+entry+'\\b'));
  const works=read('src/react/shell/WorksPage.tsx');
  for(const s of ['salvarDocumento','salvarMaterial','salvarPendencia','salvarEtapa','gerarPdfRelatorio'])assert.ok(works.includes(s),s);
  const calc=read('src/react/shell/CalculatorsPage.tsx');
  for(const s of ['exportarDetalhamentoCsv','exportarDetalhamentoDxf','gerarPdfRelatorio','validarCalculoIndependente'])assert.ok(calc.includes(s),s);
  const structural=read('src/react/shell/StructuralPage.tsx');
  for(const s of ['analisarModeloEstruturalPlano','analisarPorticoEspacial3D','salvarCargaEstrutural'])assert.ok(structural.includes(s),s);
});
test('SQLite schema and workspace paths remain unchanged during UI migration',()=>{
  const store=fs.readFileSync(new URL('../storage/sqliteStore.js',import.meta.url),'utf8');
  const electron=read('electron/main.cjs');
  assert.match(store,/engenharia360-db-v1/);
  assert.match(electron,/engenharia360\.sqlite/);
  const studio=read('electron/studioWindow.cjs');
  assert.match(studio,/studio-workspace/);
});
