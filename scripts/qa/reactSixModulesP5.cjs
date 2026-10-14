'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../app/node_modules/playwright');
(async()=>{
 const out=path.join(__dirname,'../../test/react-qa-artifacts');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1540,height:960},acceptDownloads:true});
 const faults=[];page.on('pageerror',e=>faults.push(e.message));
 const side=label=>page.locator('.studio-sidebar').getByRole('button',{name:label,exact:true});
 const screenshot=async id=>page.screenshot({path:path.join(out,'p5-'+id+'.png'),fullPage:true});
 const modules=[
  {label:'Estruturas',id:'structural',heading:'Estruturas · modelos globais'},
  {label:'Cálculos',id:'calculators',heading:'Biblioteca de cálculos'},
  {label:'Qualidade',id:'quality',heading:'Qualidade e homologação'},
  {label:'Operação',id:'operations',heading:'Operação de obra'},
  {label:'RDO',id:'rdo',heading:/RDO/},
  {label:'Financeiro',id:'finance',heading:'Financeiro local'}
 ];
 try{
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Carteira de obras'}).waitFor({timeout:25000});
  await page.getByRole('button',{name:'+ Nova obra'}).click();
  await page.locator('form input[name="codigo"]').fill('QA-P5-2026-001');
  await page.locator('form input[name="nome"]').fill('Obra P5 · QA visual');
  await page.getByRole('button',{name:'Criar obra'}).click();
  await page.getByRole('heading',{name:'Obra P5 · QA visual'}).first().waitFor();
  for(const module of modules){
    await side(module.label).click();
    const root=page.getByTestId('cbim-p5-'+module.id);
    await root.getByRole('heading',{name:module.heading,level:1}).waitFor();
    assert.equal(await root.locator('.cbim-p5-hero').count(),1);
    assert.equal(await root.locator('.cbim-p5-kpi').count(),4);
    const states=await root.locator('.cbim-p5-kpi').allTextContents();
    assert.ok(states.every(x=>x.trim().length>4));
    await screenshot(module.id+'-desktop');
  }
  await side('Cálculos').click();
  const calc=page.getByTestId('cbim-p5-calculators');
  const search=calc.getByRole('searchbox',{name:'Encontrar calculadora'});
  await search.fill('busca-sem-resultado-p5-99');
  await calc.getByText('Nenhuma calculadora corresponde à pesquisa.').waitFor();
  assert.equal(await calc.locator('.cbim-react-calc-groups details').count(),0);
  await screenshot('calculators-search-empty');
  await search.fill('');
  assert.ok(await calc.locator('.cbim-react-calc-groups details').count()>3);
  await side('RDO').click();
  const rdo=page.getByTestId('cbim-p5-rdo');
  await rdo.getByRole('searchbox',{name:'Pesquisar RDOs'}).fill('não-existe-p5');
  await rdo.getByText('Nenhum RDO cadastrado para o contexto solicitado.').waitFor();
  await rdo.getByRole('combobox',{name:'Filtrar estado dos RDOs'}).selectOption('aprovados');
  await screenshot('rdo-filter-empty');
  await side('Qualidade').click();
  await page.getByText('Preview QA · não homologado').first().waitFor();
  // Check constrained layout in a narrow viewport, including accessible tabs.
  await page.setViewportSize({width:390,height:844});
  for(const module of modules){
   await side(module.label).click();
   const root=page.getByTestId('cbim-p5-'+module.id);await root.waitFor();
   const box=await root.locator('.cbim-p5-hero').boundingBox();
   assert.ok(box&&box.width>=200&&box.width<500,module.id+' mobile hero must fit viewport');
   await screenshot(module.id+'-mobile');
  }
  assert.deepEqual(faults,[]);
  console.log('P5 QA: six real React pages, canonical KPI projection, calculator search, RDO filter and mobile width.');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
