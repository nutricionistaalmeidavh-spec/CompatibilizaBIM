import {prepararVinculoBim} from '../src/engineering/contextualStudies.js';
import {simularImpacto5D} from '../src/engineering/p4Impact.js';
import {validarCalculoIndependente} from '../src/validation/independentOracle.js';
import {garantirRdoMutavel,garantirMedicaoTransicao,validarQuantidadeRecebida} from '../src/domain/approvalGuards.js';
import {assertStudyWorkAssociation,MEASUREMENT_LINK,parseTraceLink} from '../src/domain/p1Traceability.js';
import {projectWorkProgress} from '../src/domain/workProgress.js';
import {insertStudyAnalysis} from '../src/domain/bimAnalysisPersistence.js';
import initSqlJs from 'sql.js';
import schemaSql from './schema.sql?raw';
import { migrarBancoCompatibilidade } from './schemaMigrations.js';
import { validarCargaEstrutural } from '../src/domain/structuralModel.js';
import { validarContratoBackup, calcularChecksumCrc32 } from '../src/storage/backupContract.js';

const STORAGE_KEY = 'engenharia360-db-v1';
const WASM_PATH = '/sql-wasm.wasm';
let dbAtual = null;

function bytesParaBase64(bytes) {
  let binario = '';
  bytes.forEach((byte) => { binario += String.fromCharCode(byte); });
  return btoa(binario);
}

function base64ParaBytes(base64) {
  const binario = atob(base64);
  return Uint8Array.from(binario, (char) => char.charCodeAt(0));
}

export function salvarBanco(db = dbAtual) {
  if (!db) throw new Error('Banco ainda não foi aberto');
  const base64 = bytesParaBase64(db.export());
  if (globalThis.engineeringStorage?.saveSync) {
    const result = globalThis.engineeringStorage.saveSync(base64);
    if (result !== true) throw new Error(result?.error || 'Não foi possível salvar o banco local. O último estado em disco foi preservado.');
  } else localStorage.setItem(STORAGE_KEY, base64);
}

export async function abrirBanco() {
  if (dbAtual) return dbAtual;
  const SQL = await initSqlJs({ locateFile: () => WASM_PATH });
  const fonte = globalThis.engineeringStorage?.loadSync?.();
  if (fonte && typeof fonte === 'object' && fonte.ok === false) throw new Error('Falha ao ler o banco local: ' + fonte.error);
  const salvo = fonte || localStorage.getItem(STORAGE_KEY);
  dbAtual = salvo ? new SQL.Database(base64ParaBytes(salvo)) : new SQL.Database();
  try {
    migrarBancoCompatibilidade(dbAtual, schemaSql);
    salvarBanco();
  } catch (error) {
    dbAtual.close();
    dbAtual = null;
    throw error;
  }
  return dbAtual;
}

function linhas(db, sql, params = []) {
  const stmt = db.prepare(sql); stmt.bind(params); const saida = [];
  while (stmt.step()) saida.push(stmt.getAsObject());
  stmt.free(); return saida;
}

export function listarObras(db) {
  const works=linhas(db, `SELECT o.*, COALESCE((SELECT COUNT(*) FROM rdos r WHERE r.obra_id=o.id),0) AS rdos_total,
    COALESCE((SELECT COUNT(*) FROM pendencias p WHERE p.obra_id=o.id AND p.status <> 'resolvida'),0) AS pendencias_abertas
    FROM obras o ORDER BY o.atualizado_em DESC`);
  const stages=linhas(db,'SELECT obra_id,percentual_concluido,percentual_peso FROM etapas');
  return projectWorkProgress(works,stages);
}

export function lerWorkspaceContext(db) {
  const row = linhas(db, 'SELECT * FROM workspace_context WHERE id = 1', [])[0];
  if (!row) return { obraId: null, frenteId: null, periodo: { inicio: null, fim: null }, bimMode: 'independente', projetoBimId:null };
  return { obraId: row.obra_id, frenteId: row.frente_id, periodo: { inicio: row.periodo_inicio, fim: row.periodo_fim }, bimMode: row.bim_mode === 'vinculado' ? 'vinculado' : 'independente', projetoBimId:row.projeto_bim_id??null };
}

export function salvarWorkspaceContext(db, context = {}) {
  const periodo = context.periodo ?? {};
  db.run(`INSERT INTO workspace_context (id,obra_id,frente_id,periodo_inicio,periodo_fim,bim_mode,projeto_bim_id,atualizado_em)
    VALUES (1,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET obra_id=excluded.obra_id, frente_id=excluded.frente_id,
      periodo_inicio=excluded.periodo_inicio, periodo_fim=excluded.periodo_fim,
      bim_mode=excluded.bim_mode, projeto_bim_id=excluded.projeto_bim_id, atualizado_em=excluded.atualizado_em`, [context.obraId ?? null, context.frenteId ?? null, periodo.inicio ?? null, periodo.fim ?? null, context.bimMode === 'vinculado' ? 'vinculado' : 'independente', context.projetoBimId??null, new Date().toISOString()]);
  salvarBanco(db);
}

export function salvarModuleLink(db, dados = {}) {
  const id = dados.id ?? `link_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  db.run('INSERT INTO module_links (id,module_id,entity_id,obra_id,frente_id,source,criado_em) VALUES (?,?,?,?,?,?,?)', [id, dados.moduleId, dados.entityId ?? null, dados.obraId ?? null, dados.frenteId ?? null, dados.source ?? dados.moduleId, new Date().toISOString()]);
  salvarBanco(db); return id;
}
export function listarModuleLinks(db, obraId = null) { return linhas(db, obraId ? 'SELECT * FROM module_links WHERE obra_id = ? ORDER BY criado_em DESC' : 'SELECT * FROM module_links ORDER BY criado_em DESC', obraId ? [obraId] : []); }

export function criarObraPersistida(db, dados) {
  const agora = new Date().toISOString();
  const id = dados.id ?? `obra_${Date.now().toString(36)}`;
  db.run(`INSERT INTO obras (id,codigo,nome,cliente,endereco,responsavel_tecnico,status,data_inicio,data_previsao_termino,criado_em,atualizado_em)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [id, dados.codigo, dados.nome, dados.cliente ?? null, dados.endereco ?? null, dados.responsavelTecnico ?? null, dados.status ?? 'planejamento', dados.dataInicio ?? null, dados.dataPrevisaoTermino ?? null, agora, agora]);
  salvarBanco(db); return id;
}

export function salvarModeloEstrutural(db, obraId, dados = {}) {
  const id = dados.id ?? `modelo_estrutural_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO modelos_estruturais (id,obra_id,nome,norma,unidade,status,versao,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?)', [id, obraId, dados.nome, dados.norma ?? null, dados.unidade ?? 'kN-m', dados.status ?? 'rascunho', Number(dados.versao ?? 1), agora, agora]);
  registrarHistorico(db, obraId, 'modelo_estrutural', id, 'criado', { nome: dados.nome }); salvarBanco(db); return id;
}
export function listarModelosEstruturais(db, obraId) { return linhas(db, 'SELECT * FROM modelos_estruturais WHERE obra_id = ? ORDER BY atualizado_em DESC', [obraId]); }
export function buscarModeloEstrutural(db, modeloId) {
  const modelo = linhas(db, 'SELECT * FROM modelos_estruturais WHERE id = ?', [modeloId])[0]; if (!modelo) return null;
  modelo.pavimentos = linhas(db, 'SELECT * FROM pavimentos_estruturais WHERE modelo_id = ? ORDER BY nivel, criado_em', [modeloId]);
  modelo.nos = linhas(db, 'SELECT * FROM nos_estruturais WHERE modelo_id = ? ORDER BY nome', [modeloId]).map((item) => ({ ...item, supports: { ux: Boolean(item.apoio_ux), uy: Boolean(item.apoio_uy), uz: Boolean(item.apoio_uz), rx: Boolean(item.apoio_rx), ry: Boolean(item.apoio_ry), rz: Boolean(item.apoio_rz) }, loads: { fx: Number(item.carga_fx), fy: Number(item.carga_fy), fz: Number(item.carga_fz), mx: Number(item.carga_mx), my: Number(item.carga_my), mz: Number(item.carga_mz) } }));
  modelo.elementos = linhas(db, 'SELECT * FROM elementos_estruturais WHERE modelo_id = ? ORDER BY tipo, nome', [modeloId]).map((item) => ({ ...item, secao: JSON.parse(item.secao_json), geometria: JSON.parse(item.geometria_json) }));
  modelo.cargas = linhas(db, 'SELECT * FROM cargas_estruturais WHERE modelo_id = ? ORDER BY combinacao, criado_em', [modeloId]); return modelo;
}
export function salvarPavimentoEstrutural(db, modeloId, dados = {}) { const id = dados.id ?? `pavimento_estrutural_${Date.now().toString(36)}`; const agora = new Date().toISOString(); db.run('INSERT INTO pavimentos_estruturais (id,modelo_id,nome,nivel,altura,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?)', [id, modeloId, dados.nome, Number(dados.nivel ?? 0), Number(dados.altura ?? 3), agora, agora]); salvarBanco(db); return id; }
export function salvarNoEstrutural(db, modeloId, dados = {}) { const id = dados.id ?? `no_estrutural_${Date.now().toString(36)}`; const agora = new Date().toISOString(); db.run('INSERT INTO nos_estruturais (id,modelo_id,pavimento_id,nome,x,y,z,apoio_ux,apoio_uy,apoio_uz,apoio_rx,apoio_ry,apoio_rz,carga_fx,carga_fy,carga_fz,carga_mx,carga_my,carga_mz,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [id, modeloId, dados.pavimentoId ?? null, dados.nome, Number(dados.x ?? 0), Number(dados.y ?? 0), Number(dados.z ?? 0), dados.supports?.ux ? 1 : 0, dados.supports?.uy ? 1 : 0, dados.supports?.uz ? 1 : 0, dados.supports?.rx ? 1 : 0, dados.supports?.ry ? 1 : 0, dados.supports?.rz ? 1 : 0, Number(dados.loads?.fx ?? 0), Number(dados.loads?.fy ?? 0), Number(dados.loads?.fz ?? 0), Number(dados.loads?.mx ?? 0), Number(dados.loads?.my ?? 0), Number(dados.loads?.mz ?? 0), agora, agora]); salvarBanco(db); return id; }
export function listarNosEstruturais(db, modeloId) { return linhas(db, 'SELECT * FROM nos_estruturais WHERE modelo_id = ? ORDER BY nome', [modeloId]); }
export function salvarElementoEstrutural(db, modeloId, dados = {}) { const id = dados.id ?? `elemento_estrutural_${Date.now().toString(36)}`; const agora = new Date().toISOString(); db.run('INSERT INTO elementos_estruturais (id,modelo_id,pavimento_id,tipo,nome,material,secao_json,geometria_json,status,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, modeloId, dados.pavimentoId ?? null, dados.tipo, dados.nome, typeof dados.material === 'object' && dados.material !== null ? JSON.stringify(dados.material) : dados.material ?? null, JSON.stringify(dados.secao ?? {}), JSON.stringify(dados.geometria ?? {}), dados.status ?? 'rascunho', agora, agora]); salvarBanco(db); return id; }
export function salvarCargaEstrutural(db, modeloId, dados = {}) {
  const validated = validarCargaEstrutural(dados);
  const elementId = dados.elementoId ?? dados.elemento_id;
  if (!elementId) throw new Error('Selecione uma barra para a carga estrutural.');
  const exists = linhas(db, 'SELECT id FROM elementos_estruturais WHERE id = ? AND modelo_id = ?', [elementId, modeloId])[0];
  if (!exists) throw new Error('A barra selecionada não pertence ao modelo estrutural.');
  const id = dados.id ?? `carga_estrutural_${Date.now().toString(36)}`;
  const agora = new Date().toISOString();
  db.run('INSERT INTO cargas_estruturais (id,modelo_id,elemento_id,tipo,descricao,valor,unidade,combinacao,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, modeloId, elementId, validated.tipo, validated.descricao, validated.valor, validated.unidade, validated.combinacao, agora, agora]);
  salvarBanco(db);
  return id;
}

export function buscarObra(db, obraId) {
  const obra = linhas(db, 'SELECT * FROM obras WHERE id = ?', [obraId])[0];
  if (!obra) return null;
  obra.etapas = linhas(db, 'SELECT * FROM etapas WHERE obra_id = ? ORDER BY rowid', [obraId]);
  obra.pendencias = linhas(db, 'SELECT * FROM pendencias WHERE obra_id = ? ORDER BY rowid DESC', [obraId]);
  obra.rdos = linhas(db, 'SELECT * FROM rdos WHERE obra_id = ? ORDER BY data DESC, rowid DESC', [obraId]).map((rdo) => ({ ...rdo, ...JSON.parse(rdo.dados_json) }));
  obra.calculos = listarCalculos(db, obraId);
  obra.materiais = listarMateriais(db, obraId);
  obra.documentos = listarDocumentos(db, obraId);
  obra.historico = listarHistorico(db, obraId);
  obra.bimModelos = listarModelosBim(db, obraId);
  obra.bimAnalises = listarAnalisesBim(db, obraId);
  obra.frentes = listarFrentes(db, obraId).map((frente) => ({ ...frente, subfrentes: listarSubfrentes(db, frente.id), checklist: listarChecklistFrente(db, frente.id) }));
  obra.medicoes = listarMedicoes(db, obraId);
  obra.contratos = listarContratos(db, obraId);
  obra.compras = listarCompras(db, obraId);
  obra.orcamento = listarOrcamento(db, obraId);
  obra.modelosEstruturais = listarModelosEstruturais(db, obraId);
  return obra;
}

export function salvarEtapa(db, obraId, dados) {
  const id = dados.id ?? `etapa_${Date.now().toString(36)}`;
  db.run(`INSERT INTO etapas (id,obra_id,nome,percentual_peso,percentual_concluido,status,responsavel) VALUES (?,?,?,?,?,?,?)`, [id, obraId, dados.nome, dados.percentualPeso ?? 0, dados.percentualConcluido ?? 0, dados.status ?? 'nao_iniciada', dados.responsavel ?? null]);
  salvarBanco(db); return id;
}

export function salvarRdo(db, obraId, dados) {
  const id = dados.id ?? `rdo_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  if (!String(dados.responsavel||'').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(dados.data||''))) throw new Error('RDO exige data ISO e responsável.');
  const payload = { ...dados, frenteId: dados.frenteId ?? globalThis.__engenharia360FrenteId ?? null };
  const json = JSON.stringify(payload);
  db.run('INSERT INTO rdos (id,obra_id,data,turno,responsavel,dados_json,status_aprovacao,criado_em) VALUES (?,?,?,?,?,?,?,?)', [id, obraId, payload.data, payload.turno ?? null, payload.responsavel, json, 'rascunho', agora]);
  salvarBanco(db); return id;
}

export function atualizarRdo(db, rdoId, dados) {
  const atual = linhas(db, 'SELECT * FROM rdos WHERE id = ?', [rdoId])[0];
  if (!atual) throw new Error('RDO não encontrado.');
  garantirRdoMutavel(atual.status_aprovacao);
  db.run('UPDATE rdos SET data = ?, turno = ?, responsavel = ?, dados_json = ?, status_aprovacao = \'rascunho\', aprovado_por = NULL, aprovado_em = NULL WHERE id = ?', [dados.data, dados.turno ?? null, dados.responsavel, JSON.stringify(dados), rdoId]);
  salvarBanco(db); return rdoId;
}

export function excluirRdo(db, rdoId, confirmacao) {
  if (confirmacao !== 'EXCLUIR') throw new Error('Digite EXCLUIR para confirmar a exclusão.');
  const row=linhas(db,'SELECT obra_id,status_aprovacao FROM rdos WHERE id = ?',[rdoId])[0];
  if(!row)throw new Error('RDO não encontrado.');
  garantirRdoMutavel(row.status_aprovacao);
  db.run('DELETE FROM rdos WHERE id = ?', [rdoId]);
  registrarHistorico(db,row.obra_id,'rdo',rdoId,'excluido');salvarBanco(db);
}

export function aprovarRdo(db, rdoId, aprovadoPor) {
  if (!String(aprovadoPor ?? '').trim()) throw new Error('Informe quem está aprovando o RDO.');
  const row=linhas(db,'SELECT obra_id,status_aprovacao FROM rdos WHERE id = ?',[rdoId])[0];
  if(!row)throw new Error('RDO não encontrado.');
  if(row.status_aprovacao==='aprovado')throw new Error('RDO já foi aprovado; aprovação não será sobrescrita.');
  db.run("UPDATE rdos SET status_aprovacao = 'aprovado', aprovado_por = ?, aprovado_em = ? WHERE id = ?", [aprovadoPor.trim(), new Date().toISOString(), rdoId]);
  registrarHistorico(db,row.obra_id,'rdo',rdoId,'aprovado',{aprovadoPor:aprovadoPor.trim()});salvarBanco(db);
}

export function salvarCalculo(db, obraId, dados) {
  const id = dados.id ?? `calc_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO calculos (id,obra_id,tipo,titulo,entradas_json,resultados_json,norma,versao,criado_em) VALUES (?,?,?,?,?,?,?,?,?)', [id, obraId, dados.tipo, dados.titulo, JSON.stringify(dados.entradas), JSON.stringify(dados.resultados), dados.norma ?? null, dados.versao ?? '0.1.0', agora]);
  registrarHistorico(db, obraId, 'calculo', id, 'criado', { tipo: dados.tipo }); salvarBanco(db); return id;
}

export function listarCalculos(db, obraId) {
  return linhas(db, 'SELECT * FROM calculos WHERE obra_id = ? ORDER BY criado_em DESC', [obraId]).map((item) => ({ ...item, entradas: JSON.parse(item.entradas_json), resultados: JSON.parse(item.resultados_json) }));
}

/**
 * Persist a new immutable preliminary mathematical study with a proven BIM context.
 * Independent BIM studies are supported; no legacy calculos row is fabricated.
 * The snapshot does not modify source IFC, clashes or approval records.
 */
export function salvarEstudoEngenhariaBim(db, dados = {}) {
  const projeto=buscarProjetoBim(db,dados.projetoId);
  const contexto=prepararVinculoBim({
    project:projeto,modeloId:dados.modeloId,analiseId:dados.analiseId||'',
    conflitoChave:dados.conflitoChave||'',elementoRef:dados.elementoRef||'',
    obraId:dados.obraId||null
  });
  const tipo=String(dados.calculadoraTipo||'').trim(),titulo=String(dados.titulo||'').trim();
  if(!tipo||!titulo)throw Error('Estudo exige cálculo e título canônicos.');
  if(!dados.entradas||!dados.resultados)throw Error('Estudo exige entradas e resultados existentes.');
  const validacao=validarCalculoIndependente(tipo,dados.entradas,dados.resultados);
  if(!validacao.ok)throw Error('A verificação matemática parcial rejeitou o estudo: '+validacao.errors.join('; '));
  const alternativas=dados.alternativas||[];
  if(!Array.isArray(alternativas)||alternativas.length>6)throw Error('Máximo de seis alternativas por estudo.');
  for(const scenario of alternativas){
    if(!scenario||typeof scenario.nome!=='string'||typeof scenario.verificacao?.ok!=='boolean'||
       typeof scenario.avaliacao?.viavel!=='boolean')
      throw Error('Alternativa inválida: use o comparador canônico.');
  }
  const nota=String(dados.nota||'').trim().slice(0,2000);
  const payload=JSON.stringify([contexto,dados.entradas,dados.resultados,validacao,alternativas]);
  if(payload.length>500_000)throw Error('Estudo excede 500 KB; reduza os dados das alternativas.');
  const id='estudobim_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
  const now=new Date().toISOString();
  db.run('BEGIN TRANSACTION');
  try {
    db.run(`INSERT INTO estudos_engenharia_bim
      (id,projeto_id,obra_id,modelo_id,analise_id,conflito_chave,elemento_ref,calculadora_tipo,titulo,
       contexto_json,entradas_json,resultados_json,validacao_json,alternativas_json,nota,status,criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      id,contexto.projetoId,contexto.obraId,contexto.modeloId,contexto.analiseId,contexto.conflitoChave,
      contexto.elementoRef,tipo,titulo,JSON.stringify(contexto),JSON.stringify(dados.entradas),
      JSON.stringify(dados.resultados),JSON.stringify(validacao),JSON.stringify(alternativas),
      nota,'preliminar',now
    ]);
    if(contexto.obraId) registrarHistorico(db,contexto.obraId,'estudo_engenharia_bim',id,'criado',{
      projetoId:contexto.projetoId,modeloId:contexto.modeloId,analiseId:contexto.analiseId,
      conflitoChave:contexto.conflitoChave,elementoRef:contexto.elementoRef
    });
    db.run('COMMIT');
  }catch(error){db.run('ROLLBACK');throw error;}
  salvarBanco(db);
  return id;
}
export function listarEstudosEngenhariaBim(db,projetoId) {
  if(!projetoId)return [];
  return linhas(db,'SELECT * FROM estudos_engenharia_bim WHERE projeto_id = ? ORDER BY criado_em DESC,id DESC',[projetoId])
    .map(row=>({
      ...row,contexto:JSON.parse(row.contexto_json),
      entradas:JSON.parse(row.entradas_json),resultados:JSON.parse(row.resultados_json),
      validacao:JSON.parse(row.validacao_json),alternativas:JSON.parse(row.alternativas_json)
    }));
}


/** Immutable P4 quantity reference: the source 5D project and operational balances are never modified. */
export function salvarImpactoEngenhariaBim(db, dados = {}) {
  const idEstudo=String(dados.estudoId||'');
  const row=linhas(db,'SELECT * FROM estudos_engenharia_bim WHERE id = ?',[idEstudo])[0];
  if(!row)throw Error('Memória BIM inexistente: nenhum quantitativo foi registrado.');
  const estudo={...row,contexto:JSON.parse(row.contexto_json),entradas:JSON.parse(row.entradas_json),
    resultados:JSON.parse(row.resultados_json),validacao:JSON.parse(row.validacao_json),
    alternativas:JSON.parse(row.alternativas_json)};
  const projeto=buscarProjetoBim(db,row.projeto_id);
  if(!projeto)throw Error('Projeto de origem não localizado.');
  if(dados.projetoId&&dados.projetoId!==projeto.id)throw Error('Projeto BIM diferente do registrado na memória.');
  const snapshot=simularImpacto5D({
    estudo,projeto,quantidades:dados.quantidades,orcamento:dados.orcamento,
    itemKey:dados.itemKey,quantidadeProposta:dados.quantidadeProposta,
    confirmacaoRevisao:dados.confirmacaoRevisao===true,hipotese:dados.hipotese
  });
  if(JSON.stringify(snapshot).length>18000)throw Error('Impacto excede limite local de registro.');
  const id='impactobim_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
  db.run('INSERT INTO impactos_engenharia_bim (id,estudo_id,projeto_id,snapshot_json,status,criado_em) VALUES (?,?,?,?,?,?)',
    [id,idEstudo,projeto.id,JSON.stringify(snapshot),'preliminar',new Date().toISOString()]);
  salvarBanco(db);
  return id;
}
export function listarImpactosEngenhariaBim(db,estudoId) {
  if(!estudoId)return [];
  return linhas(db,'SELECT * FROM impactos_engenharia_bim WHERE estudo_id = ? ORDER BY criado_em DESC,id DESC',[estudoId])
   .map(row=>({...row,snapshot:JSON.parse(row.snapshot_json)}));
}

export function salvarMaterial(db, obraId, dados) {
  const id = dados.id ?? `mat_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO materiais_obra (id,obra_id,material,unidade,quantidade_planejada,quantidade_realizada,custo_unitario,atualizado_em) VALUES (?,?,?,?,?,?,?,?)', [id, obraId, dados.material, dados.unidade ?? null, dados.quantidadePlanejada ?? 0, dados.quantidadeRealizada ?? 0, dados.custoUnitario ?? 0, agora]);
  registrarHistorico(db, obraId, 'material', id, 'criado', dados); salvarBanco(db); return id;
}

export function listarMateriais(db, obraId) { return linhas(db, 'SELECT * FROM materiais_obra WHERE obra_id = ? ORDER BY material', [obraId]); }

export function salvarDocumento(db, obraId, dados) {
  const id = dados.id ?? `doc_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO documentos_obra (id,obra_id,nome,tipo,dados_base64,criado_em) VALUES (?,?,?,?,?,?)', [id, obraId, dados.nome, dados.tipo ?? null, dados.dadosBase64 ?? null, agora]);
  registrarHistorico(db, obraId, 'documento', id, 'criado', { nome: dados.nome }); salvarBanco(db); return id;
}

// Read the original attachment only on explicit user request. Lists remain metadata-only.
export function obterDocumento(db, obraId, documentoId) {
  return linhas(db, 'SELECT id,nome,tipo,dados_base64,criado_em FROM documentos_obra WHERE id=? AND obra_id=?', [documentoId, obraId])[0] ?? null;
}
export function listarDocumentos(db, obraId) { return linhas(db, 'SELECT id,nome,tipo,criado_em FROM documentos_obra WHERE obra_id = ? ORDER BY criado_em DESC', [obraId]); }

export function registrarHistorico(db, obraId, entidade, entidadeId, acao, detalhes = {}) {
  db.run('INSERT INTO historico_obra (id,obra_id,entidade,entidade_id,acao,detalhes_json,criado_em) VALUES (?,?,?,?,?,?,?)', [`hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, obraId, entidade, entidadeId ?? null, acao, JSON.stringify(detalhes), new Date().toISOString()]);
}

// Single SQLite transaction for the reconciliation reference AND the work history.
// Does not duplicate operational/BIM quantities or create a financial entry.
export function registrarConferenciaMedicaoAtomica(db,dados,detalhes={}) {
 if(dados?.moduleId!==MEASUREMENT_LINK||!dados?.obraId||!dados?.entityId)throw Error('Contrato de conferência BIM inválido.');
 const current=JSON.parse(dados.source||'null');
 if(current?.kind!==MEASUREMENT_LINK||current.batchId!==dados.entityId||!current.operationalId||
    current.projectId!==detalhes.estudo||current.period!==detalhes.periodo)throw Error('Referência BIM não corresponde ao histórico solicitado.');
 const repeated=listarModuleLinks(db,dados.obraId).map(parseTraceLink).filter(Boolean).some(link=>
    link.kind===MEASUREMENT_LINK&&(link.batchId===current.batchId||link.operationalId===current.operationalId));
 if(repeated)throw Error('Medição BIM ou operacional já possui conferência. Vínculo duplicado bloqueado.');
 const id='link_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
 let started=false;
 try{
   db.run('BEGIN IMMEDIATE');started=true;
   db.run('INSERT INTO module_links (id,module_id,entity_id,obra_id,frente_id,source,criado_em) VALUES (?,?,?,?,?,?,?)',
     [id,MEASUREMENT_LINK,dados.entityId,dados.obraId,null,dados.source,new Date().toISOString()]);
   registrarHistorico(db,dados.obraId,'conciliacao_medicao',current.batchId,'referencia_vinculada',detalhes);
   db.run('COMMIT');started=false;
 }catch(error){
   if(started)try{db.run('ROLLBACK');}catch{}
   throw error;
 }
 salvarBanco(db);
 return id;
}

export function listarHistorico(db, obraId) { return linhas(db, 'SELECT * FROM historico_obra WHERE obra_id = ? ORDER BY criado_em DESC LIMIT 50', [obraId]); }

export function salvarFrente(db, obraId, dados) {
  const id = dados.id ?? `frente_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO frentes_servico (id,obra_id,nome,responsavel,status,percentual_concluido,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?)', [id, obraId, dados.nome, dados.responsavel ?? null, dados.status ?? 'ativa', Number(dados.percentualConcluido ?? 0), agora, agora]); salvarBanco(db); return id;
}
export function listarFrentes(db, obraId) { return linhas(db, 'SELECT * FROM frentes_servico WHERE obra_id = ? ORDER BY atualizado_em DESC', [obraId]); }

export function listarSubfrentes(db, frenteId) { return linhas(db, 'SELECT * FROM subfrentes_servico WHERE frente_id = ? ORDER BY atualizado_em DESC', [frenteId]); }
export function listarChecklistFrente(db, frenteId) { return linhas(db, 'SELECT * FROM checklist_frente WHERE frente_id = ? ORDER BY prazo, criado_em', [frenteId]); }
export function salvarSubfrente(db, frenteId, dados) {
  const id = dados.id ?? `subfrente_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO subfrentes_servico (id,frente_id,nome,descricao,status,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?)', [id, frenteId, dados.nome, dados.descricao ?? null, dados.status ?? 'ativa', agora, agora]); salvarBanco(db); return id;
}
export function salvarChecklistFrente(db, frenteId, dados) {
  const id = dados.id ?? `check_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO checklist_frente (id,frente_id,subfrente_id,item,pavimento,responsavel,prazo,status,percentual_concluido,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, frenteId, dados.subfrenteId ?? null, dados.item, dados.pavimento ?? null, dados.responsavel ?? null, dados.prazo ?? null, dados.status ?? 'pendente', Number(dados.percentualConcluido ?? 0), agora, agora]); salvarBanco(db); return id;
}
export function atualizarStatusChecklist(db, id, status) { db.run('UPDATE checklist_frente SET status = ?, percentual_concluido = ?, atualizado_em = ? WHERE id = ?', [status, status === 'concluido' ? 100 : 0, new Date().toISOString(), id]); salvarBanco(db); }

export function salvarMedicao(db, obraId, dados) {
  const id = dados.id ?? `medicao_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO medicoes_servico (id,obra_id,frente_id,descricao,unidade,quantidade,preco_unitario,periodo,status,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, obraId, dados.frenteId ?? null, dados.descricao, dados.unidade, Number(dados.quantidade ?? 0), Number(dados.precoUnitario ?? 0), dados.periodo ?? null, dados.status ?? 'rascunho', agora, agora]); salvarBanco(db); return id;
}
export function listarMedicoes(db, obraId) { return linhas(db, 'SELECT m.*, f.nome AS frente_nome FROM medicoes_servico m LEFT JOIN frentes_servico f ON f.id = m.frente_id WHERE m.obra_id = ? ORDER BY m.atualizado_em DESC', [obraId]); }
export function atualizarStatusMedicao(db, id, status, aprovadoPor = '') {
 const row=linhas(db,'SELECT obra_id,status FROM medicoes_servico WHERE id = ?',[id])[0];
 if(!row)throw new Error('Medição não encontrada.');
 garantirMedicaoTransicao(row.status,status);
 if(status==='aprovada'&&row.status!=='aprovada'&&!String(aprovadoPor).trim())throw new Error('Informe responsável pela aprovação da medição.');
 db.run('UPDATE medicoes_servico SET status = ?, atualizado_em = ? WHERE id = ?',[status,new Date().toISOString(),id]);
 registrarHistorico(db,row.obra_id,'medicao',id,'status',{anterior:row.status,novo:status,aprovadoPor:String(aprovadoPor||'').trim()||null});salvarBanco(db);
}

export function salvarContrato(db, obraId, dados) {
  const id = dados.id ?? `contrato_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO contratos_obra (id,obra_id,fornecedor,objeto,valor,inicio,fim,status,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?)', [id, obraId, dados.fornecedor, dados.objeto, Number(dados.valor ?? 0), dados.inicio ?? null, dados.fim ?? null, dados.status ?? 'vigente', agora, agora]); salvarBanco(db); return id;
}
export function listarContratos(db, obraId) { return linhas(db, 'SELECT * FROM contratos_obra WHERE obra_id = ? ORDER BY atualizado_em DESC', [obraId]).map((contract) => ({ ...contract, aditivos: linhas(db, 'SELECT * FROM aditivos_contrato WHERE contrato_id = ? ORDER BY criado_em DESC', [contract.id]) })); }
export function salvarAditivoContrato(db, contratoId, dados) { const id = dados.id ?? `aditivo_${Date.now().toString(36)}`; db.run('INSERT INTO aditivos_contrato (id,contrato_id,descricao,valor,data,criado_em) VALUES (?,?,?,?,?,?)', [id, contratoId, dados.descricao, Number(dados.valor ?? 0), dados.data ?? null, new Date().toISOString()]); salvarBanco(db); return id; }

export function salvarCompra(db, obraId, dados) {
  const id = dados.id ?? `compra_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO compras_pedidos (id,obra_id,frente_id,fornecedor,descricao,quantidade,unidade,valor_total,recebido,status,pagamento_status,pedido_em,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [id, obraId, dados.frenteId ?? null, dados.fornecedor, dados.descricao, Number(dados.quantidade ?? 0), dados.unidade ?? null, Number(dados.valorTotal ?? 0), Number(dados.recebido ?? 0), dados.status ?? 'solicitado', dados.pagamentoStatus ?? 'pendente', dados.pedidoEm ?? agora.slice(0, 10), agora, agora]);
  registrarHistorico(db, obraId, 'compra', id, 'criada', { fornecedor: dados.fornecedor, descricao: dados.descricao }); salvarBanco(db); return id;
}
export function listarCompras(db, obraId) { return linhas(db, 'SELECT c.*, f.nome AS frente_nome FROM compras_pedidos c LEFT JOIN frentes_servico f ON f.id = c.frente_id WHERE c.obra_id = ? ORDER BY c.atualizado_em DESC', [obraId]); }
export function atualizarRecebimentoCompra(db, id, recebido) { const row = linhas(db, 'SELECT quantidade FROM compras_pedidos WHERE id = ?', [id])[0]; if (!row) throw new Error('Pedido de compra não encontrado.'); const qty = validarQuantidadeRecebida(row.quantidade,recebido); const status = qty >= Number(row.quantidade) ? 'recebido' : qty > 0 ? 'recebido_parcial' : 'solicitado'; db.run('UPDATE compras_pedidos SET recebido = ?, status = ?, recebido_em = ?, atualizado_em = ? WHERE id = ?', [qty, status, qty > 0 ? new Date().toISOString() : null, new Date().toISOString(), id]); salvarBanco(db); }
export function atualizarPagamentoCompra(db, id, pagamentoStatus) { if (!['pendente', 'programado', 'pago'].includes(pagamentoStatus)) throw new Error('Status de pagamento inválido.'); db.run('UPDATE compras_pedidos SET pagamento_status = ?, pago_em = ?, atualizado_em = ? WHERE id = ?', [pagamentoStatus, pagamentoStatus === 'pago' ? new Date().toISOString() : null, new Date().toISOString(), id]); salvarBanco(db); }

export function salvarOrcamentoItem(db, obraId, dados) {
  const id = dados.id ?? `orc_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO orcamento_itens (id,obra_id,frente_id,periodo,categoria,descricao,planejado,realizado,status,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, obraId, dados.frenteId ?? null, dados.periodo, dados.categoria, dados.descricao, Number(dados.planejado ?? 0), Number(dados.realizado ?? 0), dados.status ?? 'planejado', agora, agora]);
  registrarHistorico(db, obraId, 'orcamento', id, 'criado', { categoria: dados.categoria, periodo: dados.periodo }); salvarBanco(db); return id;
}
export function listarOrcamento(db, obraId) { return linhas(db, 'SELECT o.*, f.nome AS frente_nome FROM orcamento_itens o LEFT JOIN frentes_servico f ON f.id = o.frente_id WHERE o.obra_id = ? ORDER BY o.periodo, o.categoria, o.criado_em', [obraId]); }
export function atualizarRealizadoOrcamento(db, id, realizado) { db.run('UPDATE orcamento_itens SET realizado = ?, status = ?, atualizado_em = ? WHERE id = ?', [Math.max(0, Number(realizado)), Number(realizado) > 0 ? 'em_execucao' : 'planejado', new Date().toISOString(), id]); salvarBanco(db); }

export function salvarLancamentoFinanceiro(db, dados) {
  const id = dados.id ?? `lanc_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO lancamentos_financeiros (id,obra_id,tipo,categoria,descricao,valor,vencimento,status,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?)', [id, dados.obraId ?? null, dados.tipo, dados.categoria, dados.descricao, Number(dados.valor ?? 0), dados.vencimento ?? null, dados.status ?? 'previsto', agora, agora]); salvarBanco(db); return id;
}
export function listarLancamentosFinanceiros(db, obraId = null) { const query = obraId ? 'SELECT * FROM lancamentos_financeiros WHERE obra_id = ? OR obra_id IS NULL ORDER BY vencimento DESC, criado_em DESC' : 'SELECT * FROM lancamentos_financeiros ORDER BY vencimento DESC, criado_em DESC'; return linhas(db, query, obraId ? [obraId] : []); }

export function salvarFolhaPagamento(db, dados) {
  const id = dados.id ?? `folha_${Date.now().toString(36)}`; const agora = new Date().toISOString();
  db.run('INSERT INTO folha_pagamentos (id,obra_id,colaborador,periodo,funcao,valor_bruto,status,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?)', [id, dados.obraId ?? null, dados.colaborador, dados.periodo, dados.funcao ?? null, Number(dados.valorBruto ?? 0), dados.status ?? 'previsto', agora, agora]); salvarBanco(db); return id;
}
export function listarFolhaPagamentos(db, obraId = null) { const query = obraId ? 'SELECT * FROM folha_pagamentos WHERE obra_id = ? OR obra_id IS NULL ORDER BY periodo DESC, criado_em DESC' : 'SELECT * FROM folha_pagamentos ORDER BY periodo DESC, criado_em DESC'; return linhas(db, query, obraId ? [obraId] : []); }

export function salvarPendencia(db, obraId, dados) {
  const id = dados.id ?? `pend_${Date.now().toString(36)}`;
  db.run('INSERT INTO pendencias (id,obra_id,descricao,prioridade,responsavel,prazo,status,origem) VALUES (?,?,?,?,?,?,?,?)', [id, obraId, dados.descricao, dados.prioridade ?? 'media', dados.responsavel ?? null, dados.prazo ?? null, 'aberta', dados.origem ?? 'obra']);
  if (dados.origem === 'bim') db.run('INSERT INTO module_links (id,module_id,entity_id,obra_id,frente_id,source,criado_em) VALUES (?,?,?,?,?,?,?)', [`link_${Date.now().toString(36)}`, 'pendencia', id, obraId, dados.frenteId ?? null, 'bim', new Date().toISOString()]);
  salvarBanco(db); return id;
}

export function salvarModeloBim(db, obraId, dados) {
  const id = dados.id ?? `bim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const agora = new Date().toISOString();
  db.run('INSERT INTO bim_modelos (id,obra_id,nome,disciplina,arquivo_nome,arquivo_hash,arquivo_base64,revisao,elementos_json,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, obraId, dados.nome, dados.disciplina ?? 'não definida', dados.arquivoNome ?? dados.nome, dados.arquivoHash ?? null, dados.arquivoBase64 ?? null, Number(dados.revisao ?? 1), JSON.stringify(dados.elementos ?? []), agora, agora]);
  registrarHistorico(db, obraId, 'bim_modelo', id, 'importado', { nome: dados.nome, disciplina: dados.disciplina }); salvarBanco(db); return id;
}

export function listarModelosBim(db, obraId) { return linhas(db, 'SELECT * FROM bim_modelos WHERE obra_id = ? ORDER BY atualizado_em DESC', [obraId]).map((item) => ({ ...item, elementos: JSON.parse(item.elementos_json || '[]') })); }

export function salvarAnaliseBim(db, obraId, dados) {
  const id = dados.id ?? `bimanalise_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  db.run('INSERT INTO bim_analises (id,obra_id,modelo_a_id,modelo_b_id,modo,tolerancia,afastamento,status,conflitos_json,modelos_json,proveniencia,criado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [id, obraId, dados.modeloAId, dados.modeloBId, dados.modo ?? 'intersection', Number(dados.tolerancia ?? 0.002), Number(dados.afastamento ?? 0.05), dados.status ?? 'concluida', JSON.stringify(dados.conflitos ?? []),JSON.stringify(dados.modelos||[dados.modeloAId,dados.modeloBId]),dados.proveniencia||'desconhecida', new Date().toISOString()]);
  registrarHistorico(db, obraId, 'bim_analise', id, 'executada', { modo: dados.modo, conflitos: (dados.conflitos ?? []).length }); salvarBanco(db); return id;
}

export function listarAnalisesBim(db, obraId) { return linhas(db, 'SELECT * FROM bim_analises WHERE obra_id = ? ORDER BY criado_em DESC', [obraId]).map((item) => ({ ...item, conflitos: JSON.parse(item.conflitos_json || '[]') })); }

// O workspace BIM é deliberadamente separado de obras: permite compatibilizar
// modelos recebidos antes de existir um cadastro de obra, mantendo o vínculo opcional.
export function criarProjetoBimPersistido(db, dados = {}) {
  const id = dados.id ?? `bimprojeto_${Date.now().toString(36)}`;
  const agora = new Date().toISOString();
  db.run('INSERT INTO bim_projetos (id,nome,descricao,obra_id,criado_em,atualizado_em) VALUES (?,?,?,?,?,?)', [id, dados.nome || 'Novo estudo BIM', dados.descricao ?? null, dados.obraId ?? null, agora, agora]);
  salvarBanco(db); return id;
}

export function listarProjetosBim(db) {
  return linhas(db, `SELECT p.*, o.codigo AS obra_codigo,
    COALESCE((SELECT COUNT(*) FROM bim_modelos_avulsos m WHERE m.projeto_id = p.id), 0) AS modelos_total,
    COALESCE((SELECT COUNT(*) FROM bim_analises_avulsas a WHERE a.projeto_id = p.id), 0) AS analises_total
    FROM bim_projetos p LEFT JOIN obras o ON o.id = p.obra_id ORDER BY p.atualizado_em DESC`);
}

export function vincularProjetoBimObra(db,projetoId,obraId) {
  const project=linhas(db,'SELECT id,obra_id FROM bim_projetos WHERE id = ?',[projetoId])[0];
  const change=assertStudyWorkAssociation(project,obraId);
  if(!change)return false;
  if(!linhas(db,'SELECT id FROM obras WHERE id = ?',[obraId])[0])throw Error('Obra não encontrada: nenhum vínculo foi salvo.');
  db.run('BEGIN TRANSACTION');
  try{
    db.run('UPDATE bim_projetos SET obra_id = ?, atualizado_em = ? WHERE id = ? AND obra_id IS NULL',[obraId,new Date().toISOString(),projetoId]);
    registrarHistorico(db,obraId,'bim_projeto',projetoId,'associado_a_obra',{projetoId,obraId,origem:'vinculo_explicito_p1'});
    db.run('COMMIT');
  }catch(e){db.run('ROLLBACK');throw e;}
  salvarBanco(db);return true;
}

export function buscarProjetoBim(db, projetoId) {
  const projeto = linhas(db, 'SELECT * FROM bim_projetos WHERE id = ?', [projetoId])[0];
  if (!projeto) return null;
  projeto.modelos = linhas(db, 'SELECT * FROM bim_modelos_avulsos WHERE projeto_id = ? ORDER BY atualizado_em DESC', [projetoId]).map((item) => ({ ...item, elementos: JSON.parse(item.elementos_json || '[]') }));
  projeto.analises = linhas(db, 'SELECT * FROM bim_analises_avulsas WHERE projeto_id = ? ORDER BY criado_em DESC', [projetoId]).map((item) => ({ ...item, conflitos: JSON.parse(item.conflitos_json || '[]') }));
  return projeto;
}

export function salvarModeloBimProjeto(db, projetoId, dados) {
  const id = dados.id ?? `bimavulso_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const agora = new Date().toISOString();
  db.run('INSERT INTO bim_modelos_avulsos (id,projeto_id,nome,disciplina,arquivo_nome,arquivo_hash,arquivo_base64,revisao,elementos_json,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, projetoId, dados.nome, dados.disciplina ?? 'não definida', dados.arquivoNome ?? dados.nome, dados.arquivoHash ?? null, dados.arquivoBase64 ?? null, Number(dados.revisao ?? 1), JSON.stringify(dados.elementos ?? []), agora, agora]);
  db.run('UPDATE bim_projetos SET atualizado_em = ? WHERE id = ?', [agora, projetoId]);
  salvarBanco(db); return id;
}

// Atualiza somente os elementos de um modelo BIM local. Mantém o arquivo original
// opcional e permite enriquecer estudos de demonstração sem duplicar modelos.
export function atualizarElementosModeloBimProjeto(db, modeloId, elementos = []) {
  db.run('UPDATE bim_modelos_avulsos SET elementos_json = ?, atualizado_em = ? WHERE id = ?', [JSON.stringify(elementos), new Date().toISOString(), modeloId]);
  salvarBanco(db);
}

export function salvarAnaliseBimProjeto(db, projetoId, dados) {
  const id = dados.id ?? `bimanalisav_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  insertStudyAnalysis(db,projetoId,dados,id);
  salvarBanco(db); return id;
}

export function registrarDecisaoConflitoBimProjeto(db, analiseId, chave, data) {
  const row=linhas(db,'SELECT conflitos_json FROM bim_analises_avulsas WHERE id = ?',[analiseId])[0];
  if(!row)throw new Error('Análise de coordenação não encontrada.');
  const conflicts=JSON.parse(row.conflitos_json||'[]');
  const conflict=conflicts.find(c=>c.chave===chave);
  if(!conflict)throw new Error('Conflito não encontrado na análise.');
  const status=String(data.status||''),responsavel=String(data.responsavel||'').trim(),motivo=String(data.motivo||'').trim();
  if(!['aberto','em_revisao','resolvido','ignorado'].includes(status))throw new Error('Estado inválido');
  if(['resolvido','ignorado'].includes(status)&&!responsavel)throw new Error('Responsável obrigatório');
  if(status==='ignorado'&&!motivo)throw new Error('Motivo obrigatório');
  const comentario=String(data.comentario||'').trim().slice(0,2000),timestamp=new Date().toISOString();
  Object.assign(conflict,{status,responsavel,prazo:data.prazo||'',motivo});
  if(comentario)conflict.comentarios=[...(conflict.comentarios||[]),{autor:responsavel||'Equipe local',texto:comentario,em:timestamp}];
  db.run('BEGIN TRANSACTION');
  try{
    db.run('UPDATE bim_analises_avulsas SET conflitos_json = ? WHERE id = ?',[JSON.stringify(conflicts),analiseId]);
    db.run('INSERT INTO bim_issue_events (id,analise_id,conflito_chave,status,responsavel,motivo,comentario,timestamp) VALUES (?,?,?,?,?,?,?,?)',
      ['evt_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),analiseId,chave,status,responsavel,motivo,comentario,timestamp]);
    db.run('COMMIT');
  }catch(error){db.run('ROLLBACK');throw error;}
  salvarBanco(db);
}
export function listarEventosConflitosBimProjeto(db,analiseId) {
 return linhas(db,'SELECT * FROM bim_issue_events WHERE analise_id = ? ORDER BY timestamp DESC',[analiseId]);
}

export function atualizarConflitosBimProjeto(db, analiseId, conflitos = []) {
  db.run('UPDATE bim_analises_avulsas SET conflitos_json = ? WHERE id = ?', [JSON.stringify(conflitos), analiseId]);
  salvarBanco(db);
}

export function atualizarConflitoBimProjeto(db, analiseId, indice, status) {
  const row = linhas(db, 'SELECT * FROM bim_analises_avulsas WHERE id = ?', [analiseId])[0];
  if (!row) throw new Error('Análise BIM independente não encontrada.');
  const conflitos = JSON.parse(row.conflitos_json || '[]'); const conflito = conflitos.find((item) => Number(item.indice) === Number(indice));
  if (!conflito) throw new Error('Conflito BIM não encontrado.');
  conflito.status = status; db.run('UPDATE bim_analises_avulsas SET conflitos_json = ? WHERE id = ?', [JSON.stringify(conflitos), analiseId]); salvarBanco(db);
}

export function atualizarConflitoBim(db, analiseId, indice, status) {
  const row = linhas(db, 'SELECT * FROM bim_analises WHERE id = ?', [analiseId])[0];
  if (!row) throw new Error('Análise BIM não encontrada.');
  const conflitos = JSON.parse(row.conflitos_json || '[]'); const conflito = conflitos.find((item) => Number(item.indice) === Number(indice));
  if (!conflito) throw new Error('Conflito BIM não encontrado.');
  conflito.status = status; db.run('UPDATE bim_analises SET conflitos_json = ? WHERE id = ?', [JSON.stringify(conflitos), analiseId]); salvarBanco(db);
}

export function exportarBackup(db) {
  const bytes = db.export();
  return JSON.stringify({
    versao: 1, exportadoEm: new Date().toISOString(),
    tamanhoBytes: bytes.length, checksumCrc32: calcularChecksumCrc32(bytes),
    bancoBase64: bytesParaBase64(bytes)
  }, null, 2);
}

export function importarBackup(dbAtualImportado, texto) {
  const contrato = validarContratoBackup(texto);
  if (!contrato.valido) throw new Error('Backup rejeitado: ' + contrato.erros.join(' '));
  // Before touching the current DB, ask the actual SQLite engine to validate
  // pages/indexes and at least the core work table of legacy databases.
  let candidate;
  try {
    candidate = new dbAtualImportado.constructor(contrato.bytes);
    const result = candidate.exec('PRAGMA integrity_check');
    if (result?.[0]?.values?.[0]?.[0] !== 'ok') throw new Error('O arquivo SQLite apresenta falhas de integridade.');
    const schema = candidate.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='obras'");
    if (!schema?.[0]?.values?.length) throw new Error('Backup não contém a tabela canônica de obras.');
  } finally {
    candidate?.close();
  }
  const base64 = bytesParaBase64(contrato.bytes);
  // Desktop: native IPC snapshots and atomically swaps the file.
  // Web: localStorage.setItem is atomic for one key; preserve prior backup.
  if (globalThis.engineeringStorage?.saveSync) {
    const saved = globalThis.engineeringStorage.saveSync(base64);
    if (saved !== true) throw new Error(saved?.error || 'Falha ao restaurar backup; banco atual preservado.');
  } else {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) localStorage.setItem(STORAGE_KEY + ':previous', existing);
    localStorage.setItem(STORAGE_KEY, base64);
  }
  // Keep the original in-memory DB alive until the new file is durably stored.
  window.location.reload();
}


// P3 reporting projection. This deliberately does NOT load dados_json from RDO,
// dados_base64 from documents, original DWG/IFC blobs or workspace files.
export function listarResumosQualidadeObras(db) {
 const obras=listarObras(db).map(w=>({id:w.id,etapas:[],pendencias:[],rdos:[],medicoes:[],compras:[],calculos:[]}));
 const index=new Map(obras.map(w=>[w.id,w]));
 const append=(table,sql)=>{for(const item of linhas(db,sql)){const target=index.get(item.obra_id);if(target)target[table].push(item);}};
 append('rdos',"SELECT obra_id,status_aprovacao FROM rdos");
 append('etapas',"SELECT obra_id,percentual_concluido,percentual_peso FROM etapas");
 append('pendencias',"SELECT obra_id,status FROM pendencias");
 append('medicoes',"SELECT obra_id,status FROM medicoes_servico");
 append('compras',"SELECT obra_id,quantidade,recebido,pagamento_status FROM compras_pedidos");
 for(const row of linhas(db,"SELECT obra_id,tipo,entradas_json,resultados_json FROM calculos")){
  const target=index.get(row.obra_id);if(!target)continue;
  let entradas=null,resultados=null;
  try{entradas=JSON.parse(row.entradas_json||'null');}catch{}
  try{resultados=JSON.parse(row.resultados_json||'null');}catch{}
  target.calculos.push({tipo:row.tipo,entradas,resultados});
 }
 return obras;
}
