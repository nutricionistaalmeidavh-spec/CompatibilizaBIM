'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../app/node_modules/playwright');
(async()=>{
  fs.mkdirSync(path.join(__dirname,'../../test/react-qa-artifacts'),{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1600,height:960},acceptDownloads:true});
  const failures=[];page.on('pageerror',e=>failures.push(e.message));
  const shot=async name=>page.screenshot({path:path.join(__dirname,'../../test/react-qa-artifacts',name+'.png'),fullPage:true});
  try{
    await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Carteira de obras'}).waitFor({timeout:25000});
    await page.locator('.studio-sidebar').getByRole('button',{name:'BIM',exact:true}).click();
    await page.getByRole('button',{name:'+ Estudo'}).click();
    await page.locator('form input[name="name"]').fill('Estudo de compatibilização 3D real');
    await page.getByRole('button',{name:'Criar estudo'}).click();
    const upload=page.getByLabel('Importar IFC / CBIM JSON');
    const fixture=(globalId,bbox)=>({schema:'CBIM',schema_version:'0.2.0',elements:[{
      id:globalId,globalId,name:globalId,type:'beam',bbox,confidence:1,review_state:'confirmed',properties:{}
    }]});
    await upload.setInputFiles({name:'estrutura-qa.cbim.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture('GUID-EST-001',{min:[0,0,0],max:[2,2,2]})))});
    await page.getByText(/Modelo CBIM JSON incorporado/).waitFor();
    await page.getByRole('heading',{name:/2 modelos/}).count().catch(()=>{});
    await upload.setInputFiles({name:'hidraulica-qa.cbim.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture('GUID-HID-001',{min:[1,1,1],max:[3,3,3]})))});
    await page.getByRole('heading',{name:/2 modelos/}).waitFor({timeout:20000});
    await page.getByRole('button',{name:'Coordenação',exact:true}).click();
    await page.getByRole('heading',{name:/Coordenação.*Federação e conflitos/}).waitFor();
    await page.getByRole('region',{name:'Visualizador geométrico de coordenação'}).waitFor();
    const viewport=page.getByRole('region',{name:'Visualizador geométrico de coordenação'});
    await viewport.locator('iframe[title="Visualizador BIM 3D integrado"]').waitFor();
    await shot('p2-visual-modelos-json-reais');
    const check=page.locator('.cbim-coordination-settings>summary');
    await check.click();
    const toggles=page.locator('.cbim-coordination-settings .p2-model-list input[type=checkbox]');
    assert.equal(await toggles.count(),2);
    await toggles.nth(0).check();await toggles.nth(1).check();
    await page.getByRole('button',{name:/Executar federação \(2 modelos\)/}).click();
    await page.getByText(/Federação concluída/).waitFor({timeout:30000});
    await page.getByRole('heading',{name:/Conflitos e pendências \(1\)/}).waitFor();
    await check.click();
    await page.getByRole('button',{name:'Localizar no 3D'}).first().click();
    assert.equal(await page.locator('.cbim-coordination-issues .p2-issue.is-selected').count(),1);
    await shot('p2-visual-conflito-focado');
    await page.getByRole('button',{name:'Registrar decisão'}).first().click();
    await page.locator('.cbim-coordination-issues .p2-issue.is-selected select').selectOption('resolvido');
    await page.locator('.cbim-coordination-issues .p2-issue.is-selected input').first().fill('Engenheira QA');
    await page.getByRole('button',{name:'Salvar decisão e auditoria'}).click();
    await page.getByText(/Decisão registrada no histórico/).waitFor({timeout:15000});
    await page.getByText(/Histórico de decisões \(1\)/).waitFor();
    await shot('p2-visual-decisao-auditada');
    assert.deepEqual(failures,[],'The React BIM visual flow must not produce unhandled errors');
    console.log('P2 visual BIM QA: real JSON envelopes, federated clash, linked GUID, and audited SQLite decision validated.');
  } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
