import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adicionarEtapa,
  adicionarPendencia,
  criarObra,
  criarRdo,
  registrarRdo,
  resumoObra,
  resumoRdo,
  atualizarEtapa,
} from '../src/index.js';

test('cria obra, etapas, pendência e calcula progresso ponderado', () => {
  let obra = criarObra({ codigo: 'OBR-001', nome: 'Edifício Modelo', cliente: 'Cliente Exemplo' });
  obra = adicionarEtapa(obra, { id: 'fundacao', nome: 'Fundação', percentualPeso: 40, percentualConcluido: 100, status: 'concluida' });
  obra = adicionarEtapa(obra, { id: 'estrutura', nome: 'Estrutura', percentualPeso: 60, percentualConcluido: 25, status: 'em_andamento' });
  obra = adicionarPendencia(obra, { descricao: 'Aguardar liberação da frente de serviço', prioridade: 'alta' });

  const resumo = resumoObra(obra);
  assert.equal(resumo.etapasTotal, 2);
  assert.equal(resumo.etapasConcluidas, 1);
  assert.equal(resumo.percentualConcluido, 55);
  assert.equal(resumo.pendenciasAbertas, 1);
});

test('registra RDO com equipe, serviços, materiais, impedimentos e fotos', () => {
  let obra = criarObra({ codigo: 'OBR-002', nome: 'Residencial Aurora' });
  obra = adicionarEtapa(obra, { id: 'estrutura', nome: 'Estrutura', percentualPeso: 100 });
  obra = atualizarEtapa(obra, 'estrutura', { status: 'em_andamento', percentualConcluido: 35 });
  obra = registrarRdo(obra, {
    data: '2026-08-14',
    responsavel: 'Engenharia',
    clima: { condicao: 'Ensolarado' },
    equipes: [{ funcao: 'Carpinteiros', quantidade: 4 }],
    servicosExecutados: [{ descricao: 'Montagem de formas', etapaId: 'estrutura', percentualAvanco: 10, local: 'Pavimento 2' }],
    materiaisRecebidos: [{ material: 'Madeira', quantidade: 120, unidade: 'm' }],
    impedimentos: [{ descricao: 'Aguardar projeto revisado', responsavel: 'Projetos' }],
    fotos: [{ uri: 'obra-002/rdo-2026-08-14-01.jpg', legenda: 'Frente de serviço' }],
  });

  assert.equal(obra.rdos.length, 1);
  assert.equal(resumoObra(obra).rdosRegistrados, 1);
  assert.deepEqual(resumoRdo(obra.rdos[0]), {
    equipeTotal: 4,
    servicosRegistrados: 1,
    materiaisRecebidos: 1,
    ocorrencias: 0,
    impedimentosAbertos: 1,
    fotos: 1,
  });
});

test('exige identificadores mínimos no cadastro e no RDO', () => {
  assert.throws(() => criarObra({ nome: 'Sem código' }), /codigo é obrigatório/);
  assert.throws(() => criarRdo({ data: '2026-08-14' }), /responsavel é obrigatório/);
});
