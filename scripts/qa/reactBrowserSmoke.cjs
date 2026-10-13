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
    const shellBox=await page.evaluate(()=>{
      const rect=selector=>{const b=document.querySelector(selector).getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width};};
      return {head:rect('.studio-topbar'),context:rect('.cbim-contextbar'),nav:rect('.studio-sidebar'),main:rect('.studio-content')};
    });
    assert.ok(shellBox.context.y>=shellBox.head.bottom-1,'Context should be directly below topbar');
    assert.ok(shellBox.nav.y>=shellBox.context.bottom-1,'Navigation should be below the context row');
    assert.ok(shellBox.main.y>=shellBox.context.bottom-1,'Main content should be below context row');
    assert.ok(shellBox.main.x>=shellBox.nav.right-1,'Main content must be to the right of sidebar');
    assert.ok(shellBox.main.width>600,'Main content must not collapse into sidebar width');
    await screenshots('01-obras');
    await page.getByRole('button',{name:'+ Nova obra'}).click();
    await page.locator('form input[name="codigo"]').fill('QA-AUTOMATIZADA-001');
    await page.locator('form input[name="nome"]').fill('Obra de regressão React');
    await page.getByRole('button',{name:'Criar obra'}).click();
    await page.getByRole('heading',{name:'Obra de regressão React'}).first().waitFor();
    await page.getByRole('navigation',{name:'Caminho atual'}).getByText('Obras').waitFor();
    assert.ok(await page.getByRole('table',{name:'Eventos da obra'}).count()===1,'History must be a single accessible canonical table');
    await page.getByRole('heading',{name:'Conferência para encerramento'}).waitFor();
    await page.locator('[data-testid="work-closeout"]').getByText(/Nenhum RDO aprovado/).waitFor();
    await screenshots('p2-encerramento-sem-dados');
    await section('BIM','Compatibilização BIM');
    await page.getByRole('button',{name:'+ Estudo'}).click();
    await page.locator('form input[name="name"]').fill('Estudo P2 QA');
    await page.getByRole('button',{name:'Criar estudo'}).click();
    await page.getByRole('button',{name:'Vincular estudo à obra atual'}).click();
    await page.getByText(/Estudo vinculado à obra/).first().waitFor();
    await page.getByRole('navigation',{name:'Caminho atual'}).getByText('BIM').waitFor();
    // A BIM study without a model cannot offer a Model/Element selector. Import a
    // real CBIM JSON fixture via the same UI path used by engineers before linking a calculation.
    const qaModel={
      schema:'CBIM',schema_version:'0.2.0',
      elements:[{id:'G-QA-001',name:'Tubulação hidráulica de QA',type:'pipe',
        diameter:0.05,path:[{x:0,y:0,z:0},{x:2,y:0,z:0}],confidence:1,
        review_state:'confirmed',properties:{}}]
    };
    await page.getByLabel('Importar IFC / CBIM JSON').setInputFiles({
      name:'qa-struct.cbim.json',mimeType:'application/json',
      buffer:Buffer.from(JSON.stringify(qaModel))
    });
    await page.getByText(/Modelo CBIM JSON incorporado/).waitFor();
    await page.getByRole('heading',{name:/Estudo P2 QA · 1 modelos/}).waitFor();
    await page.getByLabel('Buscar modelos do estudo').fill('qa-struct');
    await page.getByText('1 de 1 arquivo(s) encontrados no estudo.').waitFor();
    await page.getByText(/SHA-256 verificado na importação/).waitFor();

    await page.getByLabel('Buscar modelos do estudo').fill('inexistente');
    await page.getByText('Nenhum modelo encontrado. Limpe o filtro para visualizar os demais.').waitFor();
    await page.getByLabel('Buscar modelos do estudo').fill('');


    await page.getByRole('button',{name:'Coordenação',exact:true}).click();
    await page.getByRole('heading',{name:/Coordenação.*Federação e conflitos/}).waitFor();
    await page.getByLabel('Pesquisar conflitos BIM').fill('GUID-SEM-RESULTADO');
    await page.getByText('0 pendência(s) coincidem com os filtros de estado e pesquisa.').waitFor();
    await page.getByLabel('Pesquisar conflitos BIM').fill('');

    assert.equal(await page.getByRole('heading',{name:/Quantitativos 5D, cronograma 4D e medições/}).count(),0,'No duplicate 4D panel in coordination step');
    await screenshots('p1-coordenacao-estudo');
    await page.getByRole('button',{name:'Revisão CBIM',exact:true}).click();
    await page.getByRole('heading',{name:/Revisão CBIM.*origem e proveniência/}).waitFor();
    await page.getByRole('button',{name:'4D/5D',exact:true}).click();
    await page.getByRole('heading',{name:/Quantitativos 5D, cronograma 4D e medições/}).waitFor();
    await page.getByRole('heading',{name:/Consulta IFC \(P3\)/}).waitFor();
    await page.getByText(/Extraia QTO de um IFC original antes de consultar elementos/).waitFor();

    await page.getByRole('heading',{name:/Conferência BIM.*medição operacional/}).waitFor();
    await page.getByRole('button',{name:'Cronograma 4D'}).click();
    await page.getByRole('heading',{name:'Cronograma de atividades'}).waitFor();
    await page.getByRole('region',{name:'Prévia da importação 4D'}).locator('input[type=file]').setInputFiles({
      name:'qa-schedule.csv',mimeType:'text/csv',
      buffer:Buffer.from('activity_id,name,start_date,end_date,predecessors\nA,Instalação,2026-10-01,2026-10-10,\n')
    });
    await page.getByRole('heading',{name:/Conferir antes de importar/}).waitFor();
    await page.getByRole('table',{name:'Prévia das atividades'}).waitFor();
    await page.getByRole('button',{name:'Descartar prévia'}).click();

    await screenshots('p2-cronograma');
    await page.getByRole('button',{name:'Medições',exact:true}).click();
    await page.getByRole('heading',{name:/Medição física cumulativa/}).waitFor();
    await screenshots('p2-medicoes');

    await section('Qualidade','Qualidade e homologação');
    await page.getByRole('heading',{name:'Alertas verificáveis nos dados'}).waitFor();
    await page.getByText('Obras examinadas').first().waitFor();
    const p3Download=page.waitForEvent('download',{timeout:15000});
    await page.getByRole('button',{name:'Exportar diagnóstico JSON (sem dados pessoais)'}).click();
    const p3Evidence=await p3Download;
    const payload=JSON.parse(fs.readFileSync(await p3Evidence.path(),'utf8'));
    assert.equal(payload.distributionScope,'QA_ONLY');
    assert.equal(payload.humanHomologated,false);
    assert.ok(payload.diagnostic.summary.workCount>=1);
    assert.ok(!JSON.stringify(payload).includes('Obra de regressão React'),'QA export must not leak work names');
    await page.getByRole('button',{name:'Homologação',exact:true}).click();
    await page.getByRole('heading',{name:'Gates externos obrigatórios · F9'}).waitFor();
    await page.getByText(/Aprovação comercial não pode ser obtida/).waitFor();
    await screenshots('p3-homologacao');
    await section('Cálculos','Biblioteca de cálculos');
    await page.getByRole('button',{name:'Viga biapoiada completa'}).first().click();
    await page.getByRole('button',{name:'Calcular e validar'}).click();
    await page.getByRole('heading',{name:/Verificação matemática parcial aprovada/}).waitFor();
    assert.ok(await page.getByRole('button',{name:'Memória PDF'}).isVisible());
    // P2/P3: an existing BIM study remains selected without silently assigning any model.
    await page.getByRole('heading',{name:'Dimensionamento inverso e comparação de alternativas'}).waitFor();
    await page.getByRole('button',{name:'Buscar candidato viável'}).click();
    await page.getByRole('heading',{name:'Candidato encontrado'}).waitFor();
    await page.getByRole('button',{name:'Comparar cenários'}).click();
    await page.getByText('Situação inicial',{exact:true}).waitFor();
    await page.getByText('Alternativa manual',{exact:true}).waitFor();
    await page.getByRole('heading',{name:'Registrar memória no estudo BIM'}).waitFor();
    await page.getByLabel('Modelo de origem').selectOption({label:'qa-struct.cbim.json · rev. 1 · hydraulic'});
    await page.getByLabel('Elemento do modelo (opcional)').selectOption('G-QA-001');
    await page.getByRole('button',{name:'Salvar estudo preliminar vinculado'}).click();
    const outcome=page.locator('.cbim-bim-study [role="alert"], .cbim-bim-study [role="status"]').last();
    await outcome.waitFor({timeout:15000});
    const outcomeText=await outcome.innerText();
    assert.match(outcomeText,/Estudo preliminar registrado no projeto BIM/,'P2 linked-save failed: '+outcomeText);
    await page.getByRole('heading',{name:/Memórias de engenharia vinculadas/}).waitFor();
    await page.getByRole('button',{name:'Ver memória'}).first().click();
    await page.getByText(/Oráculo matemático parcial aprovado/).last().waitFor();
    await screenshots('p2-p3-engenharia-assistida');
    await section('Estruturas','Estruturas · modelos globais');
    await section('Operação','Operação de obra');
    await page.locator('form input[name="nome"]').first().fill('Frente QA');
    await page.getByRole('button',{name:'Cadastrar frente'}).click();
    await page.locator('article b').filter({hasText:'Frente QA'}).first().waitFor();
    await page.getByRole('button',{name:'Medições',exact:true}).click();
    await page.locator('form input[name="descricao"]').fill('Medição de escopo P0');
    await page.locator('form input[name="periodo"]').fill('2026-10');
    await page.locator('form input[name="quantidade"]').fill('2');
    await page.locator('form input[name="preco"]').fill('15');
    await page.getByRole('button',{name:'Salvar medição'}).click();
    await page.getByText('Medição de escopo P0').waitFor();
    await page.locator('.cbim-contextbar input[type="date"]').first().fill('2026-09-01');
    await page.locator('.cbim-contextbar input[type="date"]').last().fill('2026-09-30');
    assert.equal(await page.getByText('Medição de escopo P0').count(),0,'September filter must remove October measurement');
    await page.locator('.cbim-contextbar input[type="date"]').first().fill('2026-10-01');
    await page.locator('.cbim-contextbar input[type="date"]').last().fill('2026-10-31');
    await page.getByText('Medição de escopo P0').waitFor();
    await screenshots('p0-period-filter');
    await page.locator('.cbim-contextbar input[type="date"]').first().fill('');
    await page.locator('.cbim-contextbar input[type="date"]').last().fill('');
    await page.getByRole('button',{name:'Compras',exact:true}).click();
    await page.getByRole('heading',{name:'Rastreabilidade · compras e materiais'}).waitFor();
    await screenshots('p1-compras-materiais');
    await section('RDO',/RDO/);
    await page.getByRole('button',{name:'+ Novo RDO completo'}).click();
    await page.locator('form textarea').first().waitFor();
    await screenshots('rdo-form');
    const rdoForm=page.locator('form.cbim-react-panel').first();
    await rdoForm.getByLabel('Responsável',{exact:true}).fill('Responsável QA');
    await rdoForm.getByRole('button',{name:'Adicionar serviço'}).click();
    await rdoForm.getByLabel('Descrição do serviço').fill('Inspeção em tubulação hidráulica');
    await rdoForm.getByRole('button',{name:'Adicionar equipe'}).click();
    await rdoForm.getByLabel('Função').fill('Encanador');
    await rdoForm.getByLabel('Quantidade da equipe').fill('2');
    await rdoForm.getByRole('button',{name:'Adicionar material recebido'}).click();
    await rdoForm.getByLabel('Material',{exact:true}).fill('Tubo PVC 50 mm');
    await rdoForm.getByLabel('Quantidade do material').fill('10.5');
    await rdoForm.getByLabel('Unidade',{exact:true}).fill('m');
    await rdoForm.locator('input[type=file]').setInputFiles({
      name:'evidencia.png',mimeType:'image/png',
      buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/dFoAAAAASUVORK5CYII=','base64')
    });
    await rdoForm.getByRole('button',{name:'Salvar RDO'}).click();
    await page.getByRole('button',{name:'PDF com fotos'}).waitFor();
    const documentPromise=page.waitForEvent('download',{timeout:15000});
    await page.getByRole('button',{name:'PDF com fotos'}).click();
    const exported=await documentPromise;
    assert.match(exported.suggestedFilename(),/RDO-.*\.pdf/);
    assert.match(fs.readFileSync(await exported.path()).toString('latin1'),/\/Subtype \/Image/,'RDO must contain an actual photographic PDF page');
    await screenshots('f7-rdo-with-photo');
    await page.getByRole('textbox',{name:'Nome do aprovador'}).fill('Coordenador QA');
    await page.getByRole('button',{name:'Aprovar',exact:true}).click();
    const approvalModal=page.getByRole('dialog',{name:'Aprovar RDO definitivamente?'});
    await approvalModal.waitFor();
    assert.ok(await page.locator('article').filter({hasText:'Responsável QA'}).getByText(/rascunho/).count()>=1,
      'RDO must remain a draft until confirmation');
    await approvalModal.getByRole('button',{name:'Aprovar RDO'}).click();
    await page.locator('article').filter({hasText:'Responsável QA'}).getByText(/aprovado/).waitFor();
    assert.equal(await page.getByRole('button',{name:'Editar',exact:true}).count(),0,'Approved RDO must be immutable from UI');
    await page.getByRole('button',{name:'Criar retificação'}).click();
    await page.getByRole('heading',{name:'Novo RDO'}).waitFor();
    assert.equal(await page.locator('[data-rdo-kind="servicos"] textarea').count(),0,'Corrections do not repeat executed services automatically');
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.getByRole('button',{name:'Novo com equipe do último dia'}).click();
    await page.getByLabel('Função').waitFor();
    assert.equal(await page.getByLabel('Função').inputValue(),'Encanador','Safe template reuses only work crew');
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await screenshots('p2-rdo-structured-and-immutable');
    await section('Financeiro','Financeiro local');
    await page.getByRole('button',{name:'Contas',exact:true}).click();
    await page.locator('form input[name="descricao"]').fill('Receita única da obra P0');
    await page.locator('form input[name="categoria"]').fill('Serviços');
    await page.locator('form input[name="valor"]').fill('180');
    await page.locator('form input[name="vencimento"]').fill('2026-10-12');
    await page.getByRole('button',{name:'Salvar lançamento'}).click();
    await page.getByText('Receita única da obra P0').waitFor();
    const chosenFront=await page.locator('.cbim-contextbar label').filter({hasText:'Frente'}).locator('select');
    const frontOption=await chosenFront.locator('option').filter({hasText:'Frente QA'}).getAttribute('value');
    await chosenFront.selectOption(frontOption);
    await page.getByText(/Contas são vinculadas à obra, mas não à frente/).waitFor();
    await page.getByRole('button',{name:'DRE',exact:true}).click();
    await page.getByText(/Medições aprovadas da frente/).waitFor();
    assert.equal(await page.getByText('Receitas lançadas:').count(),0,'No unscoped revenue shown under front scope');
    await screenshots('p0-finance-front-scope');
    await chosenFront.selectOption('');
    await page.getByText(/Receitas lançadas:/).waitFor();
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
    const splitHandle=page.getByRole('separator',{name:'Ajustar largura entre visualizador e inspetor'});
    await splitHandle.waitFor();
    await screenshots('review-cbim-native-3d');
    assert.deepEqual(errors,[],'Uncaught browser errors: '+errors.join('\n'));
    console.log('PASS: React-only main app, SQLite works, calculators, BIM, structural, operations, RDO, financial and history.');
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
