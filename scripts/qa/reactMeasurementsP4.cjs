'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../app/node_modules/playwright');
(async()=>{
 const output=path.join(__dirname,'../../test/react-qa-artifacts');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1560,height:980}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  // Explicit synthetic QA fixture for visual/interactivity; Python tests exercise real writes.
  await page.addInitScript(()=>{
   const line={global_id:'GUID-HID-001',source_file:'HID.ifc',element_name:'Tubulação de QA',quantity_name:'NetLength',kind:'length',value:10,unit:'m',source:'ifc_qto',ifc_class:'IfcPipeSegment'};
   const batches=[
    {batch_id:'QA-APPROVED',period:'2026-10',status:'approved',approved_by:'Engenheira QA',approved_at:'2026-10-13T15:00:00Z',lines:[{...line,previous_percent:0,cumulative_percent:30,delta_quantity:3,total_quantity:10}]},
    {batch_id:'QA-DRAFT',period:'2026-10',status:'draft',lines:[{...line,previous_percent:30,cumulative_percent:50,delta_quantity:2,total_quantity:10}]},
    {batch_id:'QA-REJECTED',period:'2026-09',status:'rejected',rejected_reason:'Não conferida',lines:[{...line,previous_percent:0,cumulative_percent:20,delta_quantity:2,total_quantity:10}]}
   ];window.__p4Actions=[];
   window.engineeringStorage={bim:{p2:async({action,params})=>{
    window.__p4Actions.push(action);
    if(action==='status')return {quantities:{record_count:1},activities:[],measurements:batches};
    if(action==='quantity_records')return {records:[line],total:1,truncated:false};
    if(action==='guid_lookup')return {entries:[{global_id:line.global_id,element_name:line.element_name,source_file:line.source_file,storey:'Térreo'}],total:1};
    if(action==='measure'){const b={batch_id:'QA-NEW',period:params.period,status:'draft',lines:[{...line,previous_percent:30,cumulative_percent:params.percent,delta_quantity:3,total_quantity:10}]};batches.push(b);return b;}
    if(action==='approve'){const b=batches.find(x=>x.batch_id===params.batch_id);b.status='approved';b.approved_by=params.approved_by;b.approved_at='2026-10-13T15:30:00Z';return {batch_id:b.batch_id,status:'approved'};}
    if(action==='reject'){const b=batches.find(x=>x.batch_id===params.batch_id);b.status='rejected';b.rejected_reason=params.reason;return {batch_id:b.batch_id,status:'rejected'};}
    throw Error('QA bridge does not implement '+action);
   }}};
  });
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Carteira de obras'}).waitFor({timeout:25000});
  await page.locator('.studio-sidebar').getByRole('button',{name:'BIM',exact:true}).click();
  await page.getByRole('button',{name:'+ Estudo'}).click();
  await page.locator('form input[name="name"]').fill('Estudo P4 QA');
  await page.getByRole('button',{name:'Criar estudo'}).click();
  await page.getByRole('button',{name:'4D/5D',exact:true}).click();
  await page.getByRole('button',{name:'Medições',exact:true}).click();
  const w=page.getByTestId('cbim-5d-workspace');await w.waitFor();
  await w.getByRole('heading',{name:'Medições e conferência técnica'}).waitFor();
  await page.screenshot({path:path.join(output,'p4-medicoes-qa-lotes.png'),fullPage:true});
  await w.getByRole('searchbox',{name:'Buscar GUID para medição'}).fill('GUID-HID');
  await w.getByRole('button',{name:'Buscar no QTO'}).click();
  await w.getByRole('button',{name:/GUID-HID-001/}).first().click();
  await w.getByRole('combobox',{name:'Grandeza QTO IFC'}).selectOption('length|NetLength');
  await w.getByRole('spinbutton',{name:'Avanço físico acumulado'}).fill('65');
  await w.getByRole('button',{name:'Criar rascunho de medição'}).click();
  await w.getByText('QA-NEW').first().waitFor();
  await w.getByRole('button',{name:'Conferir e aprovar'}).first().click();
  await w.getByRole('textbox',{name:'Responsável pela aprovação BIM'}).fill('Engenheira QA');
  await page.screenshot({path:path.join(output,'p4-medicoes-qa-confirmacao.png'),fullPage:true});
  await w.getByRole('button',{name:'Confirmar decisão'}).click();
  assert.deepEqual((await page.evaluate(()=>window.__p4Actions)).filter(x=>['guid_lookup','quantity_records','measure','approve'].includes(x)).filter((x,i,a)=>a.indexOf(x)===i).sort(),['approve','guid_lookup','measure','quantity_records']);
  await w.getByRole('combobox',{name:'Estado dos lotes BIM'}).selectOption('rejected');
  await w.getByText('QA-REJECTED').waitFor();
  await page.screenshot({path:path.join(output,'p4-medicoes-qa-filtros.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('P4 fixture UX: GUID search, quantities, draft, explicit approval and status filters validated.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
