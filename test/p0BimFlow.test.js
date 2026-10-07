import test from 'node:test';
import assert from 'node:assert/strict';
import { planejarAnaliseBim, executarAnaliseBim } from '../src/bim/p0Workflow.js';

const ifc = (name) => ({ id: name, nome: name, arquivo_nome: `${name}.ifc`, arquivo_base64: 'SVNPLTEwMzAzLTIxOw==' });
const manifest = (name) => ({ id: name, nome: name, arquivo_nome: `${name}.json`, elementos: [{ globalId: name, bbox: { min: [0,0,0], max: [1,1,1] } }] });

test('bloqueia IFC sem processador geométrico real', () => {
  assert.throws(() => planejarAnaliseBim([ifc('a'), ifc('b')]), /motor IFC real/i);
});

test('bloqueia IFC sem seus bytes originais', () => {
  assert.throws(() => planejarAnaliseBim([{ ...ifc('a'), arquivo_base64: null }, ifc('b')], { motorIfcDisponivel: true }), /arquivos IFC originais/i);
});

test('recusa analisar manifestos sem elementos geométricos', () => {
  assert.throws(() => planejarAnaliseBim([manifest('a'), { ...manifest('b'), elementos: [] }]), /sem geometria/i);
});

test('recusa misturar IFC e manifesto sem converter previamente', () => {
  assert.throws(() => planejarAnaliseBim([ifc('a'), manifest('b')], { motorIfcDisponivel: true }), /mesmo formato/i);
});

test('exige exatamente dois modelos, sem analisar pares ocultos', () => {
  assert.throws(() => planejarAnaliseBim([ifc('a'), ifc('b'), ifc('c')], { motorIfcDisponivel: true }), /dois modelos/i);
});

test('não grava análise como concluída quando motor IFC retorna resposta malformada', async () => {
  await assert.rejects(executarAnaliseBim([ifc('a'), ifc('b')], { analisarIfc: async () => ({ erro: 'falhou' }) }), /resposta inválida/i);
});

test('aceita zero conflitos apenas quando motor IFC real confirma', async () => {
  const out = await executarAnaliseBim([ifc('a'), ifc('b')], { analisarIfc: async (files) => {
    assert.equal(files.length, 2);
    assert.equal(files[0].name, 'a.ifc');
    return { conflitos: [] };
  } });
  assert.deepEqual(out.conflitos, []);
  assert.equal(out.status, 'concluida_ifc');
});

test('manifesta conflito real entre dois arquivos JSON com geometria', async () => {
  const out = await executarAnaliseBim([manifest('a'), manifest('b')], { analisarManifestos: () => [{ indice: 1 }] });
  assert.equal(out.conflitos.length, 1);
  assert.equal(out.status, 'concluida_manifesto');
});
