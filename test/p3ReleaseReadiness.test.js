import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngineeringDiagnostic,createPilotEvidenceChecklist,createSanitizedReleaseExport} from '../src/domain/p3ReleaseReadiness.js';
import qaChecks from '../scripts/p3-release-check.cjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const {evaluateQaManifest,verifyQaArtifacts}=qaChecks;
import {CALCULADORAS} from '../app/src/calculatorCatalog.js';
const work={
 id:'obra-secret-A',nome:'CLIENT-SECRET-DO-NOT-EXPORT',codigo:'JOB-HIDDEN',
 etapas:[{percentual_peso:70,percentual_concluido:100},{percentual_peso:30,percentual_concluido:60}],
 pendencias:[{id:'issue-SECRET',status:'aberta'},{status:'resolvida'}],
 rdos:[{id:'r1',status_aprovacao:'aprovado',fotos:[{uri:'data:image/png;base64,SECRET-PICTURE'}]},{id:'r2',status_aprovacao:'rascunho'}],
 calculos:[{id:'calc-1',tipo:'not-reviewed',norma:'NBR-FAKE',entradas:{valor:1},resultados:{resultados:{valor:5}}}],
 medicoes:[{id:'m1',status:'aprovada',quantidade:2,preco_unitario:100},{id:'m2',status:'rascunho',quantidade:10,preco_unitario:500}],
 compras:[{id:'p1',quantidade:10,recebido:7,valor_total:90,pagamento_status:'pago'}],
 documentos:[],materiais:[]
};
test('P3 F7/F8 marks unverified/legacy calculations without certification and counts immutable approvals separately',()=>{
 const d=createEngineeringDiagnostic({works:[work],studyCount:1,reviewLinkCount:0,mathOracleCatalog:Object.keys(CALCULADORAS)});
 assert.equal(d.summary.workCount,1);
 assert.equal(d.summary.approvedRdoCount,1);
 assert.equal(d.summary.unapprovedRdoCount,1);
 assert.equal(d.summary.approvedOperationalMeasurementCount,1);
 assert.equal(d.summary.unapprovedOperationalMeasurementCount,1);
 assert.equal(d.summary.openIssueCount,1);
 assert.equal(d.summary.mathOracleCount,34);
 assert.equal(d.summary.unsupportedCalculationCount,1);
 assert.equal(d.summary.unverifiedCalculationCount,1);
 assert.equal(d.summary.reviewLinkCount,0);
 assert.ok(d.findings.some(f=>f.code==='F8_UNSUPPORTED_CALC'));
 assert.ok(d.findings.some(f=>f.code==='F7_UNAPPROVED_RDO'));
 assert.equal(d.technicalConformityCertified,false);
 assert.equal(d.bankReconciled,false);
 assert.equal(d.dataScope,'all_works');
});
test('P3 no obra is NOT a successful commercial release, regardless of automatic calculator count',()=>{
 const d=createEngineeringDiagnostic({works:[],mathOracleCatalog:Object.keys(CALCULADORAS)});
 assert.equal(d.summary.workCount,0);
 assert.equal(d.humanApprovalRequired,true);
 assert.ok(d.findings.some(x=>x.code==='NO_WORK'));
 assert.equal(d.releaseReady,false);
});
test('P3 release pilot gates cannot be made green by self-declared booleans',()=>{
 const fake={native_dwg_backend_validated:true,disciplines_validated:['hydraulic','structure','architecture','fire'],import_coverage:1,recognition_coverage:1,real_element_count:9999,ifc_export_passed:true,desktop_smoke_passed:true,license_validation_passed:true,production_evidence_eligible:true};
 const result=createPilotEvidenceChecklist(fake);
 assert.equal(result.humanHomologated,false);
 assert.equal(result.commercialReady,false);
 assert.ok(result.gates.some(g=>g.id==='clean_windows_install'&&g.state==='pending_external'));
 assert.ok(result.gates.some(g=>g.id==='semantic_validation'&&g.state==='pending_external'));
 assert.ok(result.gates.some(g=>g.id==='client_acceptance'&&g.state==='pending_external'));
});
test('P3 offline export contains only aggregate evidence: never user, client, file or work identifiers',()=>{
 const d=createEngineeringDiagnostic({works:[work],mathOracleCatalog:Object.keys(CALCULADORAS)});
 const exportData=createSanitizedReleaseExport(d,{version:'qa-preview',timestamp:'2026-10-12T23:00:00Z'});
 const text=JSON.stringify(exportData);
 for(const sensitive of ['CLIENT-SECRET','SECRET-PICTURE','obra-secret-A','issue-SECRET','calc-1','JOB-HIDDEN','NBR-FAKE'])assert.ok(!text.includes(sensitive),sensitive);
 assert.equal(exportData.humanHomologated,false);
 assert.equal(exportData.distributionScope,'QA_ONLY');
 assert.equal(exportData.diagnostic.summary.workCount,1);
});
test('P3 missing or corrupt QA manifest is rejected; a valid QA manifest never means human release',()=>{
 const sample={
  manifestVersion:1,scope:'QA ONLY — not human homologated',
  checks:{windowsRuntimeHealth:'executed-by-build-script',realDwgIfcSmoke:'separate-windows-ci-step',humanCleanMachineInstall:'pending',commercialPilot:'pending'},
  artifacts:{installer:{filename:'setup.exe',bytes:12000,sha256:'a'.repeat(64)},runtime:{filename:'runtime.exe',bytes:12000,sha256:'b'.repeat(64)},acadsharp:{filename:'bridge.exe',bytes:12000,sha256:'c'.repeat(64)}}
 };
 assert.equal(evaluateQaManifest(sample).qaManifestValid,true);
 assert.equal(evaluateQaManifest(sample).commercialReady,false);
 assert.equal(evaluateQaManifest({...sample,scope:'COMMERCIALLY CERTIFIED'}).qaManifestValid,false);
 assert.equal(evaluateQaManifest({...sample,artifacts:{...sample.artifacts,runtime:{...sample.artifacts.runtime,sha256:'not-a-hash'}}}).qaManifestValid,false);
 assert.equal(evaluateQaManifest({...sample,checks:{...sample.checks,commercialPilot:'passed'}}).qaManifestValid,false);
});

test('P3 verifies real QA binary bytes and fails closed for a modified installer',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cbim-p3-'));
 try{
  const files={
   installer:['app','dist-installers','QA-setup.exe'],
   runtime:['runtime_min','python','cbim-runtime.exe'],
   acadsharp:['runtime_min','acadsharp','CompatibilizaBIM.ACadSharpBridge.exe']
  };
  const artifacts={};
  for(const [key,parts] of Object.entries(files)){
   const path=join(dir,...parts);mkdirSync(join(dir,...parts.slice(0,-1)),{recursive:true});
   const data=Buffer.alloc(14000,key.charCodeAt(0));writeFileSync(path,data);
   artifacts[key]={filename:parts.at(-1),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
  }
  const manifest={manifestVersion:1,scope:'QA ONLY — not human homologated',artifacts,
   checks:{windowsRuntimeHealth:'executed-by-build-script',realDwgIfcSmoke:'separate-windows-ci-step',humanCleanMachineInstall:'pending',commercialPilot:'pending'}};
  const passed=verifyQaArtifacts(manifest,dir);
  assert.equal(passed.automatedArtifactsVerified,true);
  assert.equal(passed.commercialReady,false);
  writeFileSync(join(dir,...files.installer),Buffer.alloc(14000,'x'));
  const tampered=verifyQaArtifacts(manifest,dir);
  assert.equal(tampered.automatedArtifactsVerified,false);
  assert.match(tampered.errors.join(';'),/SHA-256/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('P3 SQL quality projection never loads raw RDO JSON/photos or binary documents',()=>{
 const source=readFileSync(new URL('../storage/sqliteStore.js',import.meta.url),'utf8');
 const method=source.split('export function listarResumosQualidadeObras(db)')[1];
 assert.ok(method,'Quality projection must remain in canonical SQLite storage');
 assert.doesNotMatch(method,/SELECT[^\n]*dados_json/i);
 assert.doesNotMatch(method,/SELECT[^\n]*dados_base64/i);
 assert.match(method,/SELECT obra_id,status_aprovacao FROM rdos/);
});
