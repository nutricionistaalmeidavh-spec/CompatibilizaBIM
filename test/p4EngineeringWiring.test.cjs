const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('P4 PDF export receives persisted impacts from the canonical component state',()=>{
 const source=fs.readFileSync('app/src/react/shell/P4EngineeringPanel.tsx','utf8');
 assert.match(source,/const impacts=listarImpactosEngenhariaBim\(db,estudo\.id\)/);
 assert.match(source,/gerarMemoriaBimPdf\(\{estudo,projeto,impactos:impacts\}\)/);
 assert.doesNotMatch(source,/gerarMemoriaBimPdf\(\{estudo,projeto,impactos\}\)/);
});
