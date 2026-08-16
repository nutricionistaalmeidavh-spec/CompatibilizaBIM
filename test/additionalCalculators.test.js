import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularBaciaDetencao, calcularBlocoDuasEstacas, calcularBombaCentrifuga, calcularCalhasCondutores, calcularCapacidadeEstaca, calcularCurvaIdf, calcularLajeNervurada, calcularLigacaoParafusada, calcularOrcamentoCronograma, calcularPilarMetalico, calcularRedeEsgoto, calcularReservatorio, calcularSarjetaBocaLobo, calcularTubulacaoAguaFria, calcularVigaMetalica } from '../src/index.js';

const cases = [
  ['bacia', calcularBaciaDetencao, 'volumeProjetoM3'], ['bloco', calcularBlocoDuasEstacas, 'asAdotada'], ['bomba', calcularBombaCentrifuga, 'alturaManometricaM'], ['calhas', calcularCalhasCondutores, 'capacidadeCalhaLMin'], ['estaca', calcularCapacidadeEstaca, 'cargaAdmissivelKN'], ['idf', calcularCurvaIdf, 'intensidadeMMH'], ['laje nervurada', calcularLajeNervurada, 'momentoKNM'], ['ligacao', calcularLigacaoParafusada, 'resistenciaCorteKN'], ['orcamento', calcularOrcamentoCronograma, 'totalObra'], ['pilar metalico', calcularPilarMetalico, 'resistenciaKN'], ['esgoto', calcularRedeEsgoto, 'capacidadeLS'], ['reservatorio', calcularReservatorio, 'volumeTotalM3'], ['sarjeta', calcularSarjetaBocaLobo, 'capacidadeSarjetaLS'], ['agua fria', calcularTubulacaoAguaFria, 'perdaTotalMca'], ['viga metalica', calcularVigaMetalica, 'momentoKNM']
];
for (const [name, fn, key] of cases) test(`integra ${name}`, () => assert.equal(Number.isFinite(Number(fn().resultados[key])), true));
