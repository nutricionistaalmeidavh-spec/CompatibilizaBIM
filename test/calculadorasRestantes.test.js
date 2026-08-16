import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularVigaFlexao, calcularLajeUmaDirecao, calcularLajeDuasDirecoes, calcularPilar, calcularSapata, calcularEscada, calcularMuroArrimo } from '../src/index.js';

test('integra calculadora de viga de flexão', () => {
  const r = calcularVigaFlexao();
  assert.ok(Math.abs(r.resultados.md - 80) < 1e-9);
  assert.ok(Math.abs(r.resultados.asAdotada - 4.2323876674) < 1e-9);
});
test('integra calculadoras de laje em uma e duas direções', () => {
  const uma = calcularLajeUmaDirecao(); const duas = calcularLajeDuasDirecoes();
  assert.ok(Math.abs(uma.resultados.md - 6.3) < 1e-9); assert.equal(duas.resultados.lambda, 1.2); assert.ok(duas.resultados.x.asAdotada > 0);
});
test('integra pilar e reproduz área e esbeltez de referência', () => {
  const r = calcularPilar(); assert.equal(r.resultados.areaCM2, 800); assert.ok(Math.abs(r.resultados.lambda - 51.9615242) < 1e-6);
});
test('integra sapata e verifica tensão do solo', () => {
  const r = calcularSapata(); assert.equal(r.resultados.lado, 1.75); assert.equal(r.verificacoes.tensaoSolo, 'OK');
});
test('integra escada com reações e momento', () => {
  const r = calcularEscada(); assert.ok(Math.abs(r.resultados.md - 11.8125) < 1e-9); assert.equal(r.resultados.reacao1, 15.75);
});
test('integra muro de arrimo e suas verificações principais', () => {
  const r = calcularMuroArrimo(); assert.ok(Math.abs(r.resultados.ka - 1 / 3) < 1e-12); assert.equal(r.verificacoes.tombamento, 'OK'); assert.equal(r.verificacoes.base, 'OK');
});
