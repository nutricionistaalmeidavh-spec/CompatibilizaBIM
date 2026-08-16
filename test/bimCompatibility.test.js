import test from 'node:test';
import assert from 'node:assert/strict';
import { criarModeloBim, detectarConflitosBim, validarCabecalhoIfc } from '../src/bim/compatibility.js';

const modelo = (id, min, max) => criarModeloBim({ id, nome: id, elementos: [{ id, ifcClass: 'IfcBeam', bbox: { min, max } }] });

test('valida cabeçalho IFC e encontra interseção', () => {
  assert.equal(validarCabecalhoIfc('ISO-10303-21;\nHEADER;').valido, true);
  const conflitos = detectarConflitosBim(modelo('a', [0, 0, 0], [2, 2, 2]), modelo('b', [1, 1, 1], [3, 3, 3]));
  assert.equal(conflitos.length, 1);
  assert.equal(conflitos[0].aGlobalId, 'a');
});

test('detecta afastamento e rejeita bbox incompleto', () => {
  const conflitos = detectarConflitosBim(modelo('a', [0, 0, 0], [1, 1, 1]), modelo('b', [1.04, 0, 0], [2, 1, 1]), { modo: 'clearance', afastamento: 0.05 });
  assert.equal(conflitos.length, 1);
  assert.throws(() => criarModeloBim({ id: 'x', nome: 'x', elementos: [{ bbox: {} }] }));
});

test('rejeita IFC inválido e processa manifesto grande sem travar', () => {
  assert.equal(validarCabecalhoIfc('texto sem cabecalho IFC').valido, false);
  const elementosA = Array.from({ length: 250 }, (_, index) => ({ id: `A-${index}`, ifcClass: 'IfcBeam', bbox: { min: [index * 2, 0, 0], max: [index * 2 + 1, 1, 1] } }));
  const elementosB = [{ id: 'B-0', ifcClass: 'IfcPipeSegment', bbox: { min: [0.5, 0, 0], max: [1.5, 1, 1] } }];
  const conflitos = detectarConflitosBim(criarModeloBim({ id: 'A-grande', nome: 'A', elementos: elementosA }), criarModeloBim({ id: 'B-grande', nome: 'B', elementos: elementosB }));
  assert.equal(conflitos.length, 1);
});
