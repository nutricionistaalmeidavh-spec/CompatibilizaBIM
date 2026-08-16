import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularPilarAvancado } from '../src/calculators/pilarAvancado.js';

test('calcula segunda ordem e interação N-M do pilar avançado', () => {
  const resultado = calcularPilarAvancado({ cargaKN: 10, momentoKNM: 20, larguraCM: 30, alturaCM: 40, comprimentoFlambagemM: 3, moduloElasticidadeMPa: 30000, fckMPa: 25, fykMPa: 500, cobrimentoCM: 3, fatorReducaoIncendio: 0.85 });
  assert.ok(resultado.resultados.cargaCriticaEulerKN > 0);
  assert.ok(resultado.resultados.momentoSegundaOrdemKNM >= 20);
  assert.equal(resultado.verificacoes.incendio, 'FATORES REDUZIDOS APLICADOS');
});

test('sinaliza instabilidade quando N supera Euler', () => {
  const resultado = calcularPilarAvancado({ cargaKN: 1e9, momentoKNM: 1, larguraCM: 20, alturaCM: 20, comprimentoFlambagemM: 10 });
  assert.equal(resultado.verificacoes.estabilidade, 'INSTÁVEL — N ≥ Ncr');
  assert.equal(resultado.resultados.momentoSegundaOrdemKNM, null);
});
