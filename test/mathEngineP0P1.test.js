import test from 'node:test';
import assert from 'node:assert/strict';
import { CALCULADORAS, CALCULATOR_GROUPS } from '../app/src/calculatorCatalog.js';
import { listarResultadosTecnicos, gerarSensibilidade } from '../src/engineering/mathPresentation.js';
import { diagramasVigaBiapoiada } from '../src/engineering/beamDiagrams.js';

test('P0: 34 calculadoras aparecem exatamente uma vez na navegação canônica', () => {
  const all = Object.keys(CALCULADORAS).sort();
  const grouped = CALCULATOR_GROUPS.flatMap(group => group.ids).sort();
  assert.deepEqual(grouped, all);
});
test('P0: resultados técnicos exibem rótulos, grandezas numéricas e não inventam unidade', () => {
  const rows = listarResultadosTecnicos({ resultados: { momentoKNM: 37.5, flechaCM: 1.25, coeficiente: 0.8, aninhado: { taxaUtilizacao: 0.6 } } });
  assert.ok(rows.some(row => row.path === 'momentoKNM' && row.unit === 'kN·m' && row.value === 37.5));
  assert.ok(rows.some(row => row.path === 'flechaCM' && row.unit === 'cm'));
  assert.ok(rows.some(row => row.path === 'coeficiente' && row.unit === ''));
  assert.ok(rows.some(row => row.path === 'aninhado.taxaUtilizacao'));
});
test('P1: diagrama idealizado de viga biapoiada respeita equilíbrio e máximos', () => {
  const diagram = diagramasVigaBiapoiada({ vaoM: 5, cargaPermanenteKNM: 8, cargaAcidentalKNM: 4 });
  assert.equal(diagram.momentoMaxKNM, 37.5);
  assert.equal(diagram.cortanteMaxKN, 30);
  assert.equal(diagram.momento[0].y, 0);
  assert.equal(diagram.momento.at(-1).y, 0);
  assert.equal(diagram.momento[10].y, 37.5);
});
test('P1: sensibilidade tem eixo e resultado proveniente do motor existente', () => {
  const definition = CALCULADORAS.vigaMetalica;
  const inputs = Object.fromEntries(definition.fields.map(([k,,value]) => [k,value]));
  const graph = gerarSensibilidade({ definition, inputs, inputKey: 'vaoM', resultPath: 'resultados.momentoKNM' });
  assert.equal(graph.points.length, 5);
  assert.ok(graph.points.every(point => point.x > 0 && Number.isFinite(point.y)));
  assert.ok(graph.points[0].y < graph.points.at(-1).y);
});
test('P1: entradas de sensibilidade inválidas não geram dados artificiais', () => {
  const definition = CALCULADORAS.vigaMetalica;
  const inputs = Object.fromEntries(definition.fields.map(([k,,value]) => [k,value]));
  assert.throws(() => gerarSensibilidade({definition,inputs,inputKey:'inexistente',resultPath:'resultados.momentoKNM'}));
});
