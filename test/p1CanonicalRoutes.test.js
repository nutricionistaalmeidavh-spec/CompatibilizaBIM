import test from 'node:test';import assert from 'node:assert/strict';
import { STUDIO_ROUTES, normalizeStudioRoute, activeSection } from '../app/src/react/shell/navigation.js';
test('F1 canonical navigation does not duplicate BIM review or Obras history',()=>{
 assert.equal(STUDIO_ROUTES.filter(x=>x.key==='BIM').length,1);
 assert.equal(new Set(STUDIO_ROUTES.map(x=>x.key)).size,STUDIO_ROUTES.length);
 assert.equal(STUDIO_ROUTES.some(x=>x.key==='Revisão'),false);
 assert.equal(STUDIO_ROUTES.some(x=>x.key==='Histórico'),false);
 assert.equal(normalizeStudioRoute('Revisão'),'BIM');
 assert.equal(normalizeStudioRoute('Histórico'),'Obras');
});
test('F1 section mapping remains predictable and saved legacy routes recover',()=>{
 assert.equal(activeSection('BIM'),'Projetos');
 assert.equal(activeSection('RDO'),'Execução');
 assert.equal(normalizeStudioRoute('unknown'),'Obras');
});
