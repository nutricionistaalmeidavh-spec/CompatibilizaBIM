import test from 'node:test';
import assert from 'node:assert/strict';
import { validarElementoEstrutural, validarModeloEstrutural, validarPavimentoEstrutural, validarCargaEstrutural } from '../src/domain/structuralModel.js';

test('valida o cadastro mínimo do modelo estrutural global', () => {
  assert.deepEqual(validarModeloEstrutural({ nome: 'Edifício A', norma: 'ABNT NBR 6118' }), { nome: 'Edifício A', norma: 'ABNT NBR 6118', unidade: 'kN-m', status: 'rascunho' });
  assert.throws(() => validarModeloEstrutural({ nome: '' }), /nome/);
});

test('valida pavimentos, elementos e cargas do modelo', () => {
  assert.equal(validarPavimentoEstrutural({ nome: 'Térreo', nivel: 0, altura: 3 }).altura, 3);
  assert.equal(validarElementoEstrutural({ tipo: 'viga', nome: 'V1' }).tipo, 'viga');
  assert.equal(validarCargaEstrutural({ tipo: 'distribuída', valor: 5, unidade: 'kN/m' }).combinacao, 'permanente');
  assert.throws(() => validarElementoEstrutural({ tipo: 'parede_inexistente', nome: 'X' }), /inválido/);
  assert.throws(() => validarCargaEstrutural({ tipo: 'pontual', valor: 2 }), /unidade/);
});
