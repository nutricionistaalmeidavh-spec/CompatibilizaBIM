import { criarModeloBim, detectarConflitosBim, validarCabecalhoIfc } from '../../src/bim/compatibility.js';
import { executarAnaliseBim, formatoModeloBim } from '../../src/bim/p0Workflow.js';
import { criarManifestoViewer, gerarViewerFederadoHtml } from '../../src/bim/viewer.js';
import { explicarConflitoBim } from '../../src/bim/explanation.js';
import { buscarProjetoBim, listarProjetosBim, criarProjetoBimPersistido, salvarModeloBimProjeto, salvarAnaliseBimProjeto, atualizarConflitoBimProjeto } from '../../storage/sqliteStore.js';

let bimProcessando = false;
let bimMensagem = '';
const escText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function hashTexto(texto) { let hash = 2166136261; for (const char of texto) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16); }
async function base64Arquivo(file) { const bytes = new Uint8Array(await file.arrayBuffer()); let bin = ''; bytes.forEach((byte) => { bin += String.fromCharCode(byte); }); return btoa(bin); }
async function lerManifesto(file) { const texto = await file.text(); if (file.name.toLowerCase().endsWith('.json')) { const data = JSON.parse(texto); return { elementos: data.elementos ?? data.elements ?? [], disciplina: data.disciplina ?? 'não definida' }; } if (!validarCabecalhoIfc(texto).valido) throw new Error(`${file.name} não possui cabeçalho IFC-SPF válido.`); return { elementos: [], disciplina: 'IFC · geometria será processada pelo backend IfcOpenShell' }; }
function download(name, content, type) { const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([content], { type })); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }

export function renderBimWorkspace(projetos, projeto, esc) {
  const active = projeto; const modelos = active?.modelos ?? []; const conflitos = active?.analises?.flatMap((a) => a.conflitos.map((c) => ({ ...c, analiseId: a.id }))) ?? [];
  const ultimaAnalise = active?.analises?.[0];
  const statusTexto = !ultimaAnalise ? 'Ainda não analisado. Nenhuma conclusão de ausência de conflitos foi emitida.'
    : ['concluida_ifc', 'concluida_manifesto'].includes(ultimaAnalise.status)
      ? (ultimaAnalise.conflitos.length === 0 ? 'Análise concluída pelo motor identificado: nenhum conflito detectado neste par.' : 'Análise concluída com conflitos para revisar.')
      : 'Análise antiga sem rastreabilidade do motor: execute novamente para confirmar os resultados.';
  const modeloSelect = modelos.map((m, i) => `<option value="${esc(m.id)}">${esc(m.nome)} (${esc(m.disciplina || 'sem disciplina')})</option>`).join('');
  return `<section class="workspace bim-workspace"><div class="section-head"><div><p class="eyebrow">COMPATIBILIDADE BIM</p><h2>Estudos e conflitos</h2><p>Compatibilize modelos com ou sem vínculo a uma obra.</p></div><span class="tag">offline</span></div><div class="bim-workspace-toolbar"><label>Estudo BIM<select id="bimProjetoSelect"><option value="">Selecione ou crie um estudo</option>${projetos.map((item) => `<option value="${esc(item.id)}" ${item.id === active?.id ? 'selected' : ''}>${esc(item.nome)}${item.obra_codigo ? ` · ${esc(item.obra_codigo)}` : ' · independente'}</option>`).join('')}</select></label><button class="small" id="novoBimProjeto">+ Novo estudo</button>${active ? `<button class="small" id="importarBimAvulso">Importar IFC/JSON</button><button class="small" id="converterDwgAvulso">Converter DWG → IFC</button><button class="small" id="analisarBimAvulso" ${modelos.length < 2 ? 'disabled' : ''}>Analisar par selecionado</button><button class="small" id="viewerBimAvulso" ${modelos.length < 1 ? 'disabled' : ''}>Viewer 3D</button>` : ''}</div>${active ? `<div class="bim-model-choices"><label>Modelo A<select id="bimModeloA">${modeloSelect}</select></label><label>Modelo B<select id="bimModeloB">${modelos.map((m,i)=>`<option value="${esc(m.id)}" ${i===1?'selected':''}>${esc(m.nome)}</option>`).join('')}</select></label></div><p id="bimActionFeedback" role="status" aria-live="polite">${esc(bimProcessando ? 'Processando, aguarde a conclusão real do motor...' : bimMensagem || statusTexto)}</p>` : ''}${!active ? '<div class="empty"><h3>Compatibilidade BIM independente</h3><p>Crie um estudo para importar dois modelos IFC sem precisar cadastrar uma obra.</p></div>' : `<div class="bim-explainer"><strong>Como ler os resultados</strong><span>Alta = elementos ocupam a mesma região; média = afastamento dentro da tolerância; baixa = revisar regra antes de liberar a revisão.</span></div><div class="model-summary-grid">${modelos.map((m) => `<article class="model-summary"><p class="eyebrow">${esc(m.disciplina)}</p><h3>${esc(m.nome)}</h3><p>${formatoModeloBim(m) === 'ifc' && !m.elementos.length ? 'IFC importado · geometria ainda não processada' : `${m.elementos.length} elementos`} · revisão ${m.revisao}</p><small>Classes: ${esc([...new Set(m.elementos.map((e) => e.ifcClass).filter(Boolean))].join(', ') || 'não informadas')}</small></article>`).join('') || '<div class="empty">Importe os modelos A e B para começar.</div>'}</div><div class="panel bim-conflicts-panel"><div class="panel-head"><div><h3>Conflitos encontrados</h3><p class="muted">Cada conflito explica o impacto e sugere a próxima ação.</p></div><div class="bim-filters"><select id="bimAvulsoFiltro"><option value="todos">Todos os status</option><option value="aberto">Abertos</option><option value="resolvido">Resolvidos</option><option value="ignorado">Ignorados</option></select><select id="bimAvulsoGravidade"><option value="todos">Todas as gravidades</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></div></div>${conflitos.length ? conflitos.map((c) => { const info = explicarConflitoBim(c); return `<article class="bim-conflict-card" data-status="${esc(info.gravidade)}" data-bim-status="${esc(c.status || 'aberto')}"><div class="conflict-title"><span class="severity severity-${info.gravidade}">${info.gravidadeLabel}</span><strong>#${c.indice} · ${esc(info.titulo)}</strong><span class="status-label">${esc(c.status || 'aberto')}</span></div><p>${esc(info.resumo)} ${esc(info.detalhe)}</p><small>${esc(info.localizacao)} · ${esc(info.recomendacao)}</small><div class="conflict-actions"><button class="small" data-independent-action="resolver" data-analise="${esc(c.analiseId)}" data-indice="${c.indice}">Resolver</button><button class="small" data-independent-action="ignorar" data-analise="${esc(c.analiseId)}" data-indice="${c.indice}">Ignorar</button><button class="small" data-independent-action="reabrir" data-analise="${esc(c.analiseId)}" data-indice="${c.indice}">Reabrir</button></div></article>`; }).join('') : '<p class="muted">Nenhum conflito listado. Confira o status da análise acima antes de concluir que não há interferências.</p>'}</div>`}</section>`;
}

export function wireBimWorkspaceEvents({ db, projetos, projetoId, obraId = null, setProjetoId, render, modal }) {
  document.querySelector('#bimProjetoSelect')?.addEventListener('change', (event) => { bimMensagem = ''; setProjetoId(event.target.value || null); render(); });
  document.querySelector('#novoBimProjeto')?.addEventListener('click', () => modal('Novo estudo BIM', `<label>Nome do estudo<input name="nome" required placeholder="Compatibilização estrutural x hidráulica" /></label><label>Descrição<textarea name="descricao" placeholder="Objetivo desta análise"></textarea></label><p class="muted">Modo atual: ${obraId ? 'vinculado à obra selecionada' : 'independente, sem exigir obra'}</p>`, (form) => { const id = criarProjetoBimPersistido(db, { nome: form.get('nome'), descricao: form.get('descricao'), obraId }); setProjetoId(id); render(); }));
  const projeto = projetoId ? buscarProjetoBim(db, projetoId) : null; if (!projeto) return;
  document.querySelector('#importarBimAvulso')?.addEventListener('click', () => modal('Importar modelo BIM independente', '<label>Arquivo IFC ou manifesto JSON<input name="arquivo" type="file" accept=".ifc,.json" required /></label><label>Disciplina<input name="disciplina" placeholder="Estrutura, Hidráulica..." /></label>', async (form) => { try { const file = form.get('arquivo'); const parsed = await lerManifesto(file); const text = file.name.toLowerCase().endsWith('.ifc') ? await file.slice(0,4096).text() : await file.text(); salvarModeloBimProjeto(db, projeto.id, { nome: file.name, arquivoNome: file.name, arquivoHash: hashTexto(text), arquivoBase64: await base64Arquivo(file), disciplina: form.get('disciplina') || parsed.disciplina, elementos: parsed.elementos }); render(); } catch (error) { alert(error.message); } }));
  document.querySelector('#viewerBimAvulso')?.addEventListener('click', async () => {
    try {
      const m = projeto.modelos;
      if (m.some(x => formatoModeloBim(x) === 'ifc')) {
        if (!m.every(x => formatoModeloBim(x) === 'ifc' && x.arquivo_base64)) throw new Error('Selecione apenas modelos IFC originais para o Viewer IFC.');
        const backend = globalThis.engineeringStorage?.bim?.generateViewerBase64;
        if (typeof backend !== 'function') throw new Error('Viewer geométrico IFC indisponível neste ambiente.');
        const result = await backend(m.map(x => ({ name: x.arquivo_nome || x.nome, base64: x.arquivo_base64 })));
        if (!result?.output) throw new Error('O motor IFC não confirmou a criação do viewer.');
        bimMensagem = 'Viewer IFC gerado pelo motor real.';
      } else {
        if (!m.every(x => x.elementos?.length)) throw new Error('Manifesto sem geometria para visualizar.');
        const manifesto = criarManifestoViewer(m, projeto.analises.flatMap((a) => a.conflitos));
        download(`viewer-bim-${projeto.id}.html`, gerarViewerFederadoHtml(manifesto), 'text/html');
        bimMensagem = 'Viewer dos manifestos geométricos gerado.';
      }
      render();
    } catch (error) { bimMensagem = 'Falha ao abrir viewer: ' + error.message; render(); }
  });
  document.querySelector('#analisarBimAvulso')?.addEventListener('click', async (event) => {
    if (bimProcessando) return;
    const idA = document.querySelector('#bimModeloA')?.value;
    const idB = document.querySelector('#bimModeloB')?.value;
    const modelos = [projeto.modelos.find(x => x.id === idA), projeto.modelos.find(x => x.id === idB)];
    const button = event.currentTarget;
    bimProcessando = true; button.disabled = true; button.textContent = 'Analisando...';
    const label = document.querySelector('#bimActionFeedback');
    if (label) label.textContent = 'Analisando os modelos selecionados; não feche o aplicativo.';
    try {
      if (!idA || !idB || idA === idB || modelos.some(x => !x)) throw new Error('Selecione dois modelos diferentes.');
      const result = await executarAnaliseBim(modelos, {
        analisarIfc: globalThis.engineeringStorage?.bim?.clashBase64,
        analisarManifestos: ([a,b]) => detectarConflitosBim(criarModeloBim(a), criarModeloBim(b), { modo: 'intersection', afastamento: .05 }),
        opcoes: { mode: 'intersection', clearance: .05, tolerance: .002 }
      });
      salvarAnaliseBimProjeto(db, projeto.id, { modeloAId: modelos[0].id, modeloBId: modelos[1].id, modo: 'intersection', conflitos: result.conflitos, status: result.status });
      bimMensagem = `Análise ${result.formato.toUpperCase()} concluída e salva: ${result.conflitos.length} conflito(s). Modelos: ${modelos[0].nome} × ${modelos[1].nome}.`;
    } catch (error) { bimMensagem = 'Análise não concluída: ' + error.message; }
    finally { bimProcessando = false; render(); }
  });
  document.querySelector('#converterDwgAvulso')?.addEventListener('click', () => {
    modal('Converter DWG em IFC pelo CBIM 2.1', `<label>Desenho DWG<input name="arquivo" type="file" accept=".dwg" required /></label><label>Disciplina<select name="disciplina"><option value="hydraulic">Hidráulica</option><option value="architecture">Arquitetura</option><option value="structure">Estrutura</option><option value="fire">Incêndio</option></select></label><p>Processamento local por ACadSharp. O resultado poderá exigir revisão humana.</p>`, async (form) => {
      if (bimProcessando) return;
      bimProcessando = true; bimMensagem = 'Iniciando conversão DWG...'; render();
      try {
        const backend = globalThis.engineeringStorage?.bim?.convertDwgBase64;
        if (typeof backend !== 'function') throw new Error('Conversão CBIM indisponível. Use o aplicativo desktop integrado.');
        const source = form.get('arquivo');
        if (!source?.name?.toLowerCase().endsWith('.dwg')) throw new Error('Selecione um desenho .dwg.');
        const discipline = form.get('disciplina');
        const result = await backend({ name: source.name, base64: await base64Arquivo(source), discipline });
        if (!result?.ifcBase64 || !result?.report?.ifc_sanity_passed) throw new Error('Conversor não confirmou IFC válido; nenhum modelo foi cadastrado.');
        salvarModeloBimProjeto(db, projeto.id, {
          nome: result.ifcName, arquivoNome: result.ifcName,
          arquivoHash: hashTexto(result.ifcBase64.slice(0,4096)),
          arquivoBase64: result.ifcBase64,
          disciplina: discipline, elementos: []
        });
        bimMensagem = `DWG convertido: ${result.ifcName}. Cobertura de importação: ${(100*(result.report.import_coverage||0)).toFixed(1)}%. Pendências para revisão: ${result.report.review_pending_count||0}. ${result.report.passed ? 'Critérios automáticos atendidos.' : 'Há critérios que exigem revisão.'} Arquivos mantidos em ${result.outputDir}.`;
      } catch (error) { bimMensagem = 'Conversão DWG não concluída: ' + error.message; }
      finally { bimProcessando = false; render(); }
    });
  });
  const applyFilters = () => { const status = document.querySelector('#bimAvulsoFiltro')?.value || 'todos'; const severity = document.querySelector('#bimAvulsoGravidade')?.value || 'todos'; document.querySelectorAll('.bim-conflict-card').forEach((card) => { card.hidden = (status !== 'todos' && card.dataset.bimStatus !== status) || (severity !== 'todos' && card.dataset.status !== severity); }); };
  document.querySelector('#bimAvulsoFiltro')?.addEventListener('change', applyFilters); document.querySelector('#bimAvulsoGravidade')?.addEventListener('change', applyFilters);
  document.querySelectorAll('[data-independent-action]').forEach((button) => button.addEventListener('click', () => { const status = button.dataset.independentAction === 'resolver' ? 'resolvido' : button.dataset.independentAction === 'ignorar' ? 'ignorado' : 'aberto'; atualizarConflitoBimProjeto(db, button.dataset.analise, Number(button.dataset.indice), status); render(); }));
}
