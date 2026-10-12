
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CALCULADORAS, CALCULATOR_GROUPS } from '../app/src/calculatorCatalog.js';

test('shared catalog is canonical for React and Vanilla during migration',()=>{
  const react=fs.readFileSync(new URL('../app/src/react/shell/CalculatorsPage.tsx',import.meta.url),'utf8');
  assert.match(react,/from '\.\.\/\.\.\/calculatorCatalog\.js'/);
  assert.ok(Object.keys(CALCULADORAS).length>=30);
  const ids=CALCULATOR_GROUPS.flatMap(group=>group.ids);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of ids){assert.ok(CALCULADORAS[id],id);assert.equal(typeof CALCULADORAS[id].fn,'function',id);}
});
test('React uses the original SQLite and BIM engine modules instead of a parallel store',()=>{
  const shell=fs.readFileSync(new URL('../app/src/react/shell/AppShell.tsx',import.meta.url),'utf8');
  const bim=fs.readFileSync(new URL('../app/src/react/shell/BimPage.tsx',import.meta.url),'utf8');
  assert.match(shell,/storage\/sqliteStore\.js/);
  assert.match(bim,/src\/bim\/p0Workflow\.js/);
  assert.match(bim,/src\/bim\/viewer\.js/);
  assert.match(bim,/salvarAnaliseBimProjeto/);
  assert.match(bim,/ifc_sanity_passed/);
});
test('React entry and canonical storage work without a Vanilla bootstrap',()=>{
  const entry=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
  assert.match(entry,/react\/main\.tsx/);
});
test('operational and financial screens use canonical storage contracts',()=>{
  const op=fs.readFileSync(new URL('../app/src/react/shell/OperationsPage.tsx',import.meta.url),'utf8');
  const fin=fs.readFileSync(new URL('../app/src/react/shell/FinancePage.tsx',import.meta.url),'utf8');
  assert.match(op,/salvarMedicao/);
  assert.match(op,/salvarCompra/);
  assert.match(op,/salvarContrato/);
  assert.match(op,/salvarOrcamentoItem/);
  assert.match(fin,/listarLancamentosFinanceiros/);
  assert.match(fin,/salvarFolhaPagamento/);
  const shell=fs.readFileSync(new URL('../app/src/react/shell/AppShell.tsx',import.meta.url),'utf8');
  assert.match(shell,/<OperationsPage /);
  assert.match(shell,/<FinancePage /);
});

test('studio review is hosted in the main Electron window without exposing SQLite to loopback',()=>{
  const win=fs.readFileSync(new URL('../app/electron/studioWindow.cjs',import.meta.url),'utf8');
  const main=fs.readFileSync(new URL('../app/electron/main.cjs',import.meta.url),'utf8');
  const preload=fs.readFileSync(new URL('../app/electron/preload.cjs',import.meta.url),'utf8');
  assert.match(main,/BrowserWindow\.fromWebContents\(event\.sender\)/);
  assert.match(win,/hostWindow \|\| new BrowserWindow/);
  assert.match(win,/returnToMainWindow/);
  assert.match(preload,/if \(trustedApp\)/);
  assert.match(preload,/studioNavigation/);
  assert.match(preload,/locationInfo\.hostname === '127\.0\.0\.1'/);
});

test('full RDO and structural paths reuse existing validators, PDFs and analysis engines',()=>{
  const rdo=fs.readFileSync(new URL('../app/src/react/shell/RdoPage.tsx',import.meta.url),'utf8');
  const structure=fs.readFileSync(new URL('../app/src/react/shell/StructuralPage.tsx',import.meta.url),'utf8');
  for(const key of ['gerarPdfRelatorio','aprovarRdo','atualizarRdo','excluirRdo'])assert.match(rdo,new RegExp(key));
  for(const key of ['analisarModeloEstruturalPlano','analisarPorticoEspacial3D','criarManifestoEstruturalViewer','validarModeloEstrutural'])assert.match(structure,new RegExp(key));
  const shell=fs.readFileSync(new URL('../app/src/react/shell/AppShell.tsx',import.meta.url),'utf8');
  assert.match(shell,/<RdoPage /);assert.match(shell,/<StructuralPage /);
});
test('checklist React field names follow the canonical SQLite schema',()=>{
  const page=fs.readFileSync(new URL('../app/src/react/shell/OperationsPage.tsx',import.meta.url),'utf8');
  assert.match(page,/salvarChecklistFrente\(db,selectedFront,\{item:/);
  assert.match(page,/\{c.item\}/);
});
