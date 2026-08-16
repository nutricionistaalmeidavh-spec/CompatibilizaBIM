import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularVigaBiapoiada, InputValidationError } from '../src/index.js';

test('reproduz os principais resultados da planilha de referência', () => {
  const r = calcularVigaBiapoiada();

  assert.equal(r.esforcos.pd, 28);
  assert.equal(r.esforcos.reacao, 70);
  assert.equal(r.esforcos.momento, 87.5);
  assert.equal(r.flexao.numeroBarras, 4);
  assert.ok(Math.abs(r.flexao.asAdotada - 4.7221367207) < 1e-9);
  assert.ok(Math.abs(r.cisalhamento.espacamentoAdotado - 27.6) < 1e-9);
  assert.equal(r.cisalhamento.verificacaoBiela.ok, true);
  assert.equal(r.ancoragem.verificacaoApoio.ok, false);
  assert.equal(r.flecha.verificacao.ok, false);
});

test('permite avaliar uma alternativa com seção e apoio maiores', () => {
  const r = calcularVigaBiapoiada({ alturaCM: 60, apoioDisponivelCM: 60 });

  assert.equal(r.ancoragem.verificacaoApoio.ok, true);
  assert.equal(r.flexao.verificacaoAsMax.ok, true);
  assert.equal(r.verificacoesGerais.larguraMinima.ok, true);
});

test('rejeita geometria incompatível', () => {
  assert.throws(
    () => calcularVigaBiapoiada({ alturaCM: 3, cobrimentoCM: 4 }),
    (error) => error instanceof InputValidationError && error.errors.some((item) => item.includes('alturaCM')),
  );
});
