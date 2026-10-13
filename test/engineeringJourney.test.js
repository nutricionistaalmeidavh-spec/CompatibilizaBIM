import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngineeringTarget,resolveSourceRecord,filterRdosByCompetence,filterEntriesByDueCompetence,quantityVarianceMessage,resolveJourneyStudy} from '../src/domain/engineeringJourney.js';
test('Navegação mantém estudo, obra, medição e competência com referências sem valores copiados',()=>{
 const target=createEngineeringTarget('Operação',{kind:'medicao',id:'MED-1',obraId:'W1',studyId:'S1',period:'2026-10'});
 assert.deepEqual(target,{kind:'medicao',obraId:'W1',studyId:'S1',id:'MED-1',period:'2026-10'});
 assert.ok(!('quantity' in target));
 assert.throws(()=>createEngineeringTarget('Financeiro',{kind:'medicao',id:'MED-1'}),/incompatível/);
 assert.throws(()=>createEngineeringTarget('RDO',{kind:'rdo-competencia',period:'2026-13'}),/inválida/);
 assert.throws(()=>createEngineeringTarget('Operação',{kind:'medicao'}),/Identificador/);
});
test('Registro real fora dos filtros é identificado, mas não muda totais nem filtros',()=>{
 const all=[{id:'M1',periodo:'2026-09'},{id:'M2',periodo:'2026-10'}],scoped=[all[1]];
 assert.deepEqual(resolveSourceRecord(all,scoped,'M1'),{record:all[0],outsideScope:true});
 assert.equal(resolveSourceRecord(all,scoped,'MISS').record,null);
 assert.equal(scoped.length,1);
});
test('RDO e contas são relacionados apenas temporalmente; datas ausentes não entram',()=>{
 const rdo=[{data:'2026-10-01'},{data:'2026-09-20'},{data:null}];
 const entries=[{vencimento:'2026-10-31'},{vencimento:'2026-11-01'},{vencimento:null}];
 assert.deepEqual(filterRdosByCompetence(rdo,'2026-10'),[rdo[0]]);
 assert.deepEqual(filterEntriesByDueCompetence(entries,'2026-10'),[entries[0]]);
});
test('Divergência física distingue direção e nulos de um zero genuíno',()=>{
 assert.match(quantityVarianceMessage(1.25,'m'),/BIM acima.*1,25 m/);
 assert.match(quantityVarianceMessage(-2,'m³'),/BIM abaixo.*2 m³/);
 assert.match(quantityVarianceMessage(0,'m'),/Sem diferença/);
 assert.match(quantityVarianceMessage(null,'m'),/indisponível/);
});
test('Fluxo React declara destino contextual, retorno e estados de referência explícitos',async()=>{
 const fs=await import('node:fs');
 const shell=fs.readFileSync(new URL('../app/src/react/shell/AppShell.tsx',import.meta.url),'utf8');
 const reconciliation=fs.readFileSync(new URL('../app/src/react/shell/BimMeasurementReconciliationPanel.tsx',import.meta.url),'utf8');
 const op=fs.readFileSync(new URL('../app/src/react/shell/OperationsPage.tsx',import.meta.url),'utf8');
 const rdo=fs.readFileSync(new URL('../app/src/react/shell/RdoPage.tsx',import.meta.url),'utf8');
 const finance=fs.readFileSync(new URL('../app/src/react/shell/FinancePage.tsx',import.meta.url),'utf8');
 assert.match(shell,/returnToSource/);
 assert.match(shell,/createEngineeringTarget/);
 assert.match(reconciliation,/Ver medição de origem/);
 assert.match(op,/RDOs da competência/);
 assert.match(rdo,/Contas da competência/);
 assert.match(finance,/Vinculado à obra, não à medição BIM/);
});

test('Mudança para financeiro não bloqueia a obra por um estudo BIM antigo de outra obra',()=>{
 const studies=[{id:'S1',obra_id:'W1'},{id:'S2',obra_id:'W2'}];
 assert.equal(resolveJourneyStudy(studies,'S1','','W2'),null);
 assert.equal(resolveJourneyStudy(studies,'S1','S2','W2'),'S2');
 assert.throws(()=>resolveJourneyStudy(studies,'S1','S1','W2'),/outra obra/);
 assert.throws(()=>resolveJourneyStudy(studies,null,'MISS','W1'),/não encontrado/);
});
