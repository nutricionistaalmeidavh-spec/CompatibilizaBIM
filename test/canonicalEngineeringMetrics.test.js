import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {calculateWorkProgress,projectWorkProgress} from '../src/domain/workProgress.js';
import {clashDistance,engineeringNumber,budgetBreakdown} from '../src/domain/engineeringPresentation.js';
import {buildWorkCloseout} from '../src/domain/workCloseout.js';
import {insertStudyAnalysis} from '../src/domain/bimAnalysisPersistence.js';
import {resumoObra} from '../src/domain/obras.js';
const require=createRequire(import.meta.url);
test('same weighted progress is used by the portfolio, domain and closeout',()=>{
 const stages=[{obra_id:'A',percentual_concluido:100,percentual_peso:20},{obra_id:'A',percentual_concluido:0,percentual_peso:80}];
 assert.equal(calculateWorkProgress(stages).value,20);
 assert.equal(projectWorkProgress([{id:'A'}],stages)[0].percentual_concluido,20);
 assert.equal(buildWorkCloseout({etapas:stages}).progress,20);
 const normalized=stages.map(s=>({percentualPeso:s.percentual_peso,percentualConcluido:s.percentual_concluido}));
 assert.equal(resumoObra({etapas:normalized}).percentualConcluido,20);
});
test('missing weights use explicit unweighted basis, missing steps are not certified progress',()=>{
 const stages=[{percentual_concluido:100,percentual_peso:0},{percentual_concluido:0,percentual_peso:0}];
 const result=calculateWorkProgress(stages);
 assert.equal(result.value,50);assert.match(result.method,/média simples/);
 assert.equal(calculateWorkProgress([]).value,null);
 assert.throws(()=>calculateWorkProgress([{percentual_concluido:Infinity}]),/inválido/);
});
test('technical numbers preserve genuine zero and mark missing distances',()=>{
 assert.equal(clashDistance(0),'0,000 m');
 assert.equal(clashDistance(undefined),'Distância não informada');
 assert.equal(clashDistance(null),'Distância não informada');
 assert.equal(engineeringNumber(2.35,2),'2,35');
 assert.equal(engineeringNumber(undefined),'Não informado');
});
test('budget decomposition includes waste and BDI; never prices missing groups',()=>{
 const report={total_cost:132,bdi_percent:10,lines:[{quantity:2,base_unit_cost:50,waste_percent:20}]};
 const value=budgetBreakdown(report);
 assert.equal(value.baseCost,100);assert.equal(value.wasteCost,20);assert.equal(value.bdiCost,12);assert.equal(value.total,132);
 assert.equal(budgetBreakdown({total_cost:0,lines:[]}),null);
 assert.equal(budgetBreakdown({total_cost:99,lines:[{quantity:2}]}),null);
});
test('SQLite persists federation model manifest and provenance through database export and reopen',async()=>{
 const initSqlJs=require('sql.js');
 const SQL=await initSqlJs({locateFile:file=>require.resolve('sql.js/dist/'+file)});
 const db=new SQL.Database();
 db.run(readFileSync(new URL('../storage/schema.sql',import.meta.url),'utf8'));
 db.run("INSERT INTO bim_projetos (id,nome,criado_em,atualizado_em) VALUES ('project','Coordenação','2026','2026')");
 insertStudyAnalysis(db,'project',{modeloAId:'m1',modeloBId:'m2',modelos:[{id:'m1'},{id:'m2'},{id:'m3'}],proveniencia:'ifcopenshell_real',status:'concluida_ifc',conflitos:[]},'analysis','2026-10-12');
 const restored=new SQL.Database(db.export());
 const row=restored.exec("SELECT modelos_json,proveniencia,status FROM bim_analises_avulsas WHERE id='analysis'")[0].values[0];
 assert.deepEqual(JSON.parse(row[0]).map(x=>x.id),['m1','m2','m3']);
 assert.equal(row[1],'ifcopenshell_real');assert.equal(row[2],'concluida_ifc');
 db.close();restored.close();
});
test('React study context remounts 4D/5D and reconciliation, and no fallback study is selected',()=>{
 const source=readFileSync(new URL('../app/src/react/shell/BimPage.tsx',import.meta.url),'utf8');
 assert.match(source,/<Bim4D5DPanel key=\{project\.id\}/);
 assert.match(source,/<BimMeasurementReconciliationPanel key=\{project\.id\}/);
 assert.doesNotMatch(source,/projects\[0\]\?\.id\|\|''/);
});
test('SQLite portfolio query delegates stage progress to canonical projection',()=>{
 const source=readFileSync(new URL('../storage/sqliteStore.js',import.meta.url),'utf8');
 assert.match(source,/return projectWorkProgress\(works,stages\)/);
 assert.doesNotMatch(source,/AVG\(e\.percentual_concluido\)/);
});
test('analysis writer delegates persistence with model manifest and provenance',()=>{
 const source=readFileSync(new URL('../storage/sqliteStore.js',import.meta.url),'utf8');
 assert.match(source,/insertStudyAnalysis\(db,projetoId,dados,id\)/);
});
