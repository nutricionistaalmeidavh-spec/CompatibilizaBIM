'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../app/node_modules/playwright');
(async()=>{
 const target=path.join(__dirname,'../../test/react-qa-artifacts');
 fs.mkdirSync(target,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Carteira de obras'}).waitFor({timeout:25000});
  await page.locator('.studio-sidebar').getByRole('button',{name:'BIM',exact:true}).click();
  await page.getByRole('button',{name:'+ Estudo'}).click();
  await page.locator('form input[name="name"]').fill('Estudo 4D QA');
  await page.getByRole('button',{name:'Criar estudo'}).click();
  await page.getByRole('button',{name:'4D/5D',exact:true}).click();
  await page.getByRole('button',{name:'Cronograma 4D'}).click();
  const workbench=page.getByTestId('cbim-4d-workspace');
  await workbench.getByRole('heading',{name:'Cronograma de atividades'}).waitFor();
  await workbench.getByRole('heading',{name:'Linha do tempo das atividades'}).waitFor();
  assert.equal(await workbench.getByText('Nenhuma atividade cadastrada. Importe CSV ou cadastre uma atividade para visualizar o Gantt.').count(),1);
  await workbench.getByRole('searchbox',{name:'Buscar atividades no Gantt'}).fill('hidráulica');
  await workbench.getByRole('combobox',{name:'Visualizar'}).selectOption('sem-vinculo');
  await page.screenshot({path:path.join(target,'p3-cronograma-4d-premium-vazio.png'),fullPage:true});
  const region=page.getByRole('region',{name:'Prévia da importação 4D'});
  await region.locator('input[type=file]').setInputFiles({name:'cronograma-qa.csv',mimeType:'text/csv',buffer:Buffer.from(
   'activity_id,name,start_date,end_date,predecessors\nA,Fundação,2026-10-01,2026-10-05,\nB,Concretagem,2026-10-06,2026-10-12,A\n')});
  await page.getByRole('heading',{name:/Conferir antes de importar/}).waitFor();
  const table=page.getByRole('table',{name:'Prévia das atividades'});
  assert.equal(await table.locator('tbody tr').count(),2);
  await page.screenshot({path:path.join(target,'p3-cronograma-4d-preview-csv.png'),fullPage:true});
  await page.getByRole('button',{name:'Descartar prévia'}).click();
  assert.equal(await workbench.getByRole('button',{name:'Registrar avanço com data'}).count(),0,'No activity: no fake progress');
  assert.equal(await workbench.getByRole('button',{name:'Simular 4D'}).isDisabled(),true,'Web mode must not simulate results');
  assert.deepEqual(errors,[],'No React errors in P3');
  console.log('P3 React UI, empty state and CSV preview successful.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
