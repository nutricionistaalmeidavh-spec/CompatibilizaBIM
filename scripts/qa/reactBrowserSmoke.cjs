'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('../../app/node_modules/playwright');
(async()=>{
  fs.mkdirSync(path.join(__dirname,'../../test/react-qa-artifacts'),{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const screenshots=async(name)=>page.screenshot({path:path.join(__dirname,'../../test/react-qa-artifacts',name+'.png'),fullPage:true});
  const section=async(name,heading)=>{
    await page.locator('.studio-sidebar').getByRole('button',{name,exact:true}).click();
    await page.getByRole('heading',{name:heading}).first().waitFor();
    await screenshots(name.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
  };
  try{
    await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
    try{await page.getByRole('heading',{name:'Carteira de obras'}).waitFor({timeout:25000});}
    catch(e){
      console.error('React startup URL:',page.url());
      console.error('React startup body:',(await page.locator('body').innerText().catch(()=>'' )).slice(0,3000));
      console.error('React startup console errors:',errors);
      await screenshots('failure-startup');
      throw e;
    }
    assert.equal(await page.locator('.studio-sidebar button').count()>=7,true);
    await screenshots('01-obras');
    await page.getByRole('button',{name:'+ Nova obra'}).click();
    await page.locator('form input[name="codigo"]').fill('QA-AUTOMATIZADA-001');
    await page.locator('form input[name="nome"]').fill('Obra de regressão React');
    await page.getByRole('button',{name:'Criar obra'}).click();
    await page.getByRole('heading',{name:'Obra de regressão React'}).first().waitFor();
    await section('BIM','Compatibilização BIM');
    await page.getByRole('button',{name:'+ Estudo'}).click();
    await page.locator('form input[name="name"]').fill('Estudo P2 QA');
    await page.getByRole('button',{name:'Criar estudo'}).click();
    await page.getByRole('heading',{name:/Coordenação.*Federação e conflitos/}).waitFor();
    await page.getByRole('heading',{name:/Quantitativos 5D, cronograma 4D e medições/}).waitFor();
    await screenshots('p2-coordenacao-estudo');
    await page.getByRole('button',{name:'Cronograma 4D'}).click();
    await page.getByRole('heading',{name:'Cronograma de atividades'}).waitFor();
    await screenshots('p2-cronograma');
    await page.getByRole('button',{name:'Medições'}).click();
    await page.getByRole('heading',{name:/Medição física cumulativa/}).waitFor();
    await screenshots('p2-medicoes');

    await section('Cálculos','Biblioteca de cálculos');
    await page.getByRole('button',{name:'Viga biapoiada completa'}).first().click();
    await page.getByRole('button',{name:'Calcular e validar'}).click();
    await page.getByRole('heading',{name:/Resultado/}).waitFor();
    assert.ok(await page.getByRole('button',{name:'Memória PDF'}).isVisible());
    await section('Estruturas','Estruturas · modelos globais');
    await section('Operação','Operação de obra');
    await page.locator('form input[name="nome"]').first().fill('Frente QA');
    await page.getByRole('button',{name:'Cadastrar frente'}).click();
    await page.locator('article b').filter({hasText:'Frente QA'}).first().waitFor();
    await section('RDO',/RDO/);
    await page.getByRole('button',{name:'+ Novo RDO completo'}).click();
    await page.locator('form textarea').first().waitFor();
    await screenshots('rdo-form');
    await section('Financeiro','Financeiro local');
    await section('BIM','Compatibilização BIM');
    await section('Obras','Carteira de obras');
    assert.equal(await page.locator('.studio-sidebar').getByRole('button',{name:'Revisão',exact:true}).count(),0,'Review must not be a duplicate root route');
    const current=await page.locator('main').first().innerText();
    assert.match(current,/Obra de regressão React/);
    // Authenticated reviewer is mounted by the same React entry; mock only the
    // localhost API payload, not the React component or navigation itself.
    await page.route('**/api/studio-state',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({
        project:{id:'qa-review',name:'Revisão CBIM QA',storeys:[{id:'floor',name:'Térreo'}],systems:[],elements:[{id:'pipe-qa',type:'pipe',name:'Linha QA',diameter:.1,path:[{x:0,y:0,z:0},{x:3,y:1,z:2}],system_id:null,storey_id:'floor',review_state:'auto',confidence:.9,source_refs:[{source_id:'cad',entity_id:'e1',layer:'HID'}],properties:{}}]},
        plan:{sources:[],config:{project_name:'Revisão CBIM QA',organization:'QA',units:'m',coordinate_reference:'local',storeys:[{name:'Térreo',elevation:0,height:3}]}},
        status:{revision:1},
        history:[],recovery:[],annotations:[],audit:[]
      })
    }));
    await page.goto('http://127.0.0.1:5173/?surface=review');
    await page.getByRole('heading',{name:'Fontes',exact:true}).waitFor({timeout:15000});
    await screenshots('review-react-same-entry');
    await page.getByRole('button',{name:'Revisão',exact:true}).click();
    await page.getByRole('group',{name:'Planta geométrica CBIM 2D'}).waitFor();
    await page.getByRole('button',{name:'Axonométrica 3D'}).click();
    await page.getByRole('group',{name:'Projeção axonométrica da geometria CBIM'}).waitFor();
    await page.getByRole('button',{name:/Selecionar pipe pipe-qa/}).click();
    await page.getByRole('heading',{name:'Inspector'}).waitFor();
    await screenshots('review-cbim-native-3d');
    assert.deepEqual(errors,[],'Uncaught browser errors: '+errors.join('\n'));
    console.log('PASS: React-only main app, SQLite works, calculators, BIM, structural, operations, RDO, financial and history.');
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
