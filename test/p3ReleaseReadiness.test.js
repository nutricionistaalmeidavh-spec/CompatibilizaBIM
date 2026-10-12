import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngineeringDiagnostic,createPilotEvidenceChecklist,createSanitizedReleaseExport} from '../src/domain/p3ReleaseReadiness.js';
import {evaluateQaManifest} from '../scripts/p3-release-check.cjs';
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
