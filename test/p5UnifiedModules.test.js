import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const parts=['StructuralPage','CalculatorsPage','QualityPage','OperationsPage','RdoPage','FinancePage'];
test('P5 six engineering modules use one shared header and canonical, auditable KPIs',()=>{
 const shared=read('../app/src/react/shell/EngineeringModuleLayout.tsx');
 assert.match(shared,/export function ModuleHero/);
 assert.match(shared,/export function ModuleKpis/);
 assert.match(shared,/export function ModuleSearch/);
 for(const part of parts){
  const src=read('../app/src/react/shell/'+part+'.tsx');
  assert.match(src,/import \{ModuleHero,ModuleKpis/);
  assert.match(src,/<ModuleHero/);
  assert.match(src,/<ModuleKpis/);
  assert.match(src,/data-testid="cbim-p5-/);
 }
});
test('P5 improves discovery but leaves canonical storage, calculations, approvals and exports wired',()=>{
 const calc=read('../app/src/react/shell/CalculatorsPage.tsx');
 const struct=read('../app/src/react/shell/StructuralPage.tsx');
 const rdo=read('../app/src/react/shell/RdoPage.tsx');
 const operations=read('../app/src/react/shell/OperationsPage.tsx');
 const finance=read('../app/src/react/shell/FinancePage.tsx');
 const quality=read('../app/src/react/shell/QualityPage.tsx');
 for(const item of ['CALCULADORAS','validarCalculoIndependente','salvarCalculo','gerarPdfRelatorio','visibleGroups','ModuleSearch'])assert.ok(calc.includes(item),item);
 for(const item of ['salvarModeloEstrutural','analisarModeloEstruturalPlano','analisarModeloEstruturalEspacial','criarManifestoEstruturalViewer'])assert.ok(struct.includes(item),item);
 for(const item of ['aprovarRdo','excluirRdo','gerarPdfRelatorioComFotos','filteredRdos','ModuleSearch'])assert.ok(rdo.includes(item),item);
 for(const item of ['salvarMedicao','atualizarStatusMedicao','EngineeringConfirmDialog','PurchaseMaterialTraceability'])assert.ok(operations.includes(item),item);
 for(const item of ['reconciliarFinanceiroObra','financialScopeRows','salvarLancamentoFinanceiro','frontScoped'])assert.ok(finance.includes(item),item);
 assert.ok(quality.includes('createEngineeringDiagnostic'));
 assert.ok(quality.includes('Preview QA · não homologado'));
});
test('P5 navigation actions are not duplicated in operational measurements',()=>{
 const src=read('../app/src/react/shell/OperationsPage.tsx');
 assert.equal((src.match(/Abrir conferência BIM<\/button>/g)||[]).length,1);
 assert.equal((src.match(/Ver RDOs da competência<\/button>/g)||[]).length,1);
 assert.equal((src.match(/Ver contas por vencimento<\/button>/g)||[]).length,1);
});
test('P5 design is scoped and responsive without adding paid services',()=>{
 const css=read('../app/src/react/studio.css');
 assert.match(css,/\.cbim-p5-module/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/\.cbim-p5-kpis/);
 assert.match(css,/\.cbim-p5-record-filters/);
});
