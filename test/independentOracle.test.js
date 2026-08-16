import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularVigaBiapoiada, calcularInsumosConcreto } from '../src/index.js';
import { validarCalculoIndependente } from '../src/validation/independentOracle.js';

test('oráculo independente confirma momento da viga', () => {
  const entrada = { vaoM: 5, cargaPermanenteKNM: 12, cargaAcidentalKNM: 8 };
  const resultado = calcularVigaBiapoiada(entrada);
  assert.equal(validarCalculoIndependente('vigaBiapoiada', resultado.entrada, resultado).ok, true);
});

test('oráculo rejeita resultado de insumos com massa negativa', () => {
  const resultado = calcularInsumosConcreto();
  resultado.resultados.cimentoTotalKg = -1;
  assert.equal(validarCalculoIndependente('insumosConcreto', resultado.entrada, resultado).ok, false);
});
