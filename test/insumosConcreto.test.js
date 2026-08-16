import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularInsumosConcreto, InsumosInputValidationError } from '../src/index.js';

test('reproduz os resultados principais da planilha de insumos', () => {
  const r = calcularInsumosConcreto();
  const out = r.resultados;

  assert.ok(Math.abs(out.somaVolumesAbsolutos - 3.6669488781) < 1e-9);
  assert.ok(Math.abs(out.cimentoKgPorM3 - 272.7062834101) < 1e-9);
  assert.ok(Math.abs(out.cimentoTotalKg - 1636.2377004609) < 1e-9);
  assert.ok(Math.abs(out.areiaTotalKg - 6675.8498178804) < 1e-9);
  assert.ok(Math.abs(out.britaTotalKg - 4843.2635933642) < 1e-9);
  assert.ok(Math.abs(out.aguaTotalLitros - 1145.3663903226) < 1e-9);
  assert.equal(out.cimentoSacos50Kg, 33);
});

test('recalcula proporcionalmente para outro volume', () => {
  const base = calcularInsumosConcreto().resultados;
  const dobrado = calcularInsumosConcreto({ volumeM3: 12 }).resultados;

  assert.equal(dobrado.cimentoTotalKg, base.cimentoTotalKg * 2);
  assert.equal(dobrado.areiaTotalKg, base.areiaTotalKg * 2);
  assert.equal(dobrado.britaTotalKg, base.britaTotalKg * 2);
  assert.equal(dobrado.aguaTotalLitros, base.aguaTotalLitros * 2);
});

test('rejeita massa específica inválida', () => {
  assert.throws(
    () => calcularInsumosConcreto({ massaEspecificaAreia: 0 }),
    (error) => error instanceof InsumosInputValidationError && error.errors.some((item) => item.includes('massaEspecificaAreia')),
  );
});
