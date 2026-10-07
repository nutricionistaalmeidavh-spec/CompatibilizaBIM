import { criarModeloBim, detectarConflitosBim, validarCabecalhoIfc } from '../../src/bim/compatibility.js';
import { executarAnaliseBim, formatoModeloBim } from '../../src/bim/p0Workflow.js';
import { criarManifestoViewer, gerarViewerFederadoHtml } from '../../src/bim/viewer.js';
import { salvarModeloBim, salvarAnaliseBim, atualizarConflitoBim, salvarPendencia, salvarModuleLink, buscarObra, listarObras } from '../../storage/sqliteStore.js';
import { enhanceBimUi } from './bimEnhancements.js';

export function renderBimPanel(obra, esc) {
  const modelos = obra.bimModelos ?? []; const analises = obra.bimAnalises ?? []; const conflitos = analises.flatMap((a) => a.conflitos.map((c) => ({ ...c, analiseId: a.id })));
  return `<section class="panel bim-panel"><div class="panel-head"><div><p class="eyebrow">COMPATIBILIDADE BIM</p><h3>Modelos e conflitos</h3></div><div><button class="small" id="importarBim">Importar IFC/manifesto</button><button class="small" id="analisarBim" ${modelos.length < 2 ? 'disabled' : ''}>Analisar modelos</button></div></div><p class="muted">${modelos.length} modelo(s) · ${conflitos.length} conflito(s) · ${analises.length ? (["concluida_ifc","concluida_manifesto"].includes(analises[0].status) ? "Última análise com motor identificado" : "Análise anterior sem identificação do motor: reprocesse") : "Não analisado"}</p>${modelos.map((m) => `<div class="row"><span>${esc(m.nome)}<small class="muted">${esc(m.disciplina)} · revisão ${m.revisao}</small></span><span>${formatoModeloBim(m) === 'ifc' && !m.elementos.length ? 'IFC aguardando análise geométrica' : `${m.elementos.length} elementos`}</span></div>`).join('') || '<p class="muted">Importe dois modelos para iniciar.</p>'}<div class="bim-filters"><label>Filtro <select id="bimFiltro"><option value="todos">Todos</option><option value="aberto">Abertos</option><option value="resolvido">Resolvidos</option><option value="ignorado">Ignorados</option></select></label></div>${conflitos.map((c) => `<div class="row bim-conflict" data-status="${esc(c.status || 'aberto')}"><span><b>#${c.indice || ''}</b> ${esc(c.aGlobalId || '')} × ${esc(c.bGlobalId || '')}<small class="muted">${esc(c.aClasse || '')} / ${esc(c.bClasse || '')}</small></span><span><button class="small" data-bim-action="resolver" data-analise="${c.analiseId}" data-indice="${c.indice}">Resolver</button><button class="small" data-bim-action="pendencia" data-analise="${c.analiseId}" data-indice="${c.indice}">Pendência</button></span></div>`).join('')}</section>`;
}

function hashTexto(texto) { let hash = 2166136261; for (const char of texto) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16); }
async function base64Arquivo(file) { const bytes = new Uint8Array(await file.arrayBuffer()); let bin = ''; bytes.forEach((byte) => { bin += String.fromCharCode(byte); }); return btoa(bin); }
async function lerManifestoBim(file) { const texto = await file.text(); if (file.name.toLowerCase().endsWith('.json')) { const data = JSON.parse(texto); return { elementos: data.elementos ?? data.elements ?? [], disciplina: data.disciplina ?? 'não definida' }; } if (!validarCabecalhoIfc(texto).valido) throw new Error(`${file.name} não possui cabeçalho IFC-SPF válido.`); return { elementos: [], disciplina: 'IFC — geometria será processada pelo backend IfcOpenShell' }; }
function baixarArquivo(nome, texto, tipo) { const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([texto], { type: tipo })); a.href = url; a.download = nome; a.click(); URL.revokeObjectURL(url); }

export function wireBimEvents({ db, obraSelecionada, setObraSelecionada, setObras, render, esc, modal }) {
  if (!obraSelecionada) return;
  const modelos = () => obraSelecionada.bimModelos ?? [];
  const filterBox = document.querySelector('.bim-filters'); if (filterBox) { const classInput = document.createElement('input'); classInput.id = 'bimClasseFiltro'; classInput.placeholder = 'Filtrar classe IFC'; filterBox.append(classInput); const jsonButton = document.createElement('button'); jsonButton.className = 'small'; jsonButton.textContent = 'JSON'; filterBox.append(jsonButton); const csvButton = document.createElement('button'); csvButton.className = 'small'; csvButton.textContent = 'CSV'; filterBox.append(csvButton); const conflictsNow = () => (obraSelecionada.bimAnalises ?? []).flatMap((a) => a.conflitos.map((c) => ({ ...c, analiseId: a.id }))); jsonButton.onclick = () => baixarArquivo(`conflitos-bim-${obraSelecionada.codigo}.json`, JSON.stringify(conflictsNow(), null, 2), 'application/json'); csvButton.onclick = () => baixarArquivo(`conflitos-bim-${obraSelecionada.codigo}.csv`, ['indice,aGlobalId,bGlobalId,aClasse,bClasse,status', ...conflictsNow().map((c) => [c.indice, c.aGlobalId, c.bGlobalId, c.aClasse, c.bClasse, c.status || 'aberto'].map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))].join('\n'), 'text/csv'); classInput.oninput = () => document.querySelectorAll('.bim-conflict').forEach((row) => { row.hidden = !!classInput.value && !row.textContent.toLowerCase().includes(classInput.value.toLowerCase()); }); }
  const actions = document.querySelector('.bim-panel .panel-head > div:last-child'); const viewer = document.createElement('button'); viewer.className = 'small'; viewer.textContent = 'Viewer 3D'; viewer.disabled = !modelos().length; actions?.append(viewer); viewer.onclick = async () => {
    try {
      const ms = modelos();
      if (ms.some(m => formatoModeloBim(m) === 'ifc')) {
        if (!ms.every(m => formatoModeloBim(m) === 'ifc' && m.arquivo_base64)) throw new Error('Modelos mistos ou IFC sem arquivo original.');
        const backend = globalThis.engineeringStorage?.bim?.generateViewerBase64;
        if (typeof backend !== 'function') throw new Error('Viewer IFC real indisponível: não há geometria local para mostrar.');
        const result = await backend(ms.map(m => ({ name: m.arquivo_nome || m.nome, base64: m.arquivo_base64 })));
        if (!result?.output) throw new Error('Viewer não confirmou a saída.');
        return;
      }
      if (!ms.every(m => Array.isArray(m.elementos) && m.elementos.length)) throw new Error('Manifestos sem elementos geométricos não podem ser visualizados.');
      const html = gerarViewerFederadoHtml(criarManifestoViewer(ms, (obraSelecionada.bimAnalises ?? []).flatMap(a => a.conflitos)));
      baixarArquivo(`viewer-bim-${obraSelecionada.codigo}.html`, html, 'text/html');
    } catch (error) { alert('Viewer não concluído: ' + error.message); }
  };
  const realViewer = document.createElement('button'); realViewer.className = 'small'; realViewer.textContent = 'Viewer IFC real'; realViewer.disabled = !(globalThis.engineeringStorage?.bim?.generateViewerBase64 && modelos().every((m) => m.arquivo_base64)); actions?.append(realViewer); realViewer.onclick = async () => { try { const result = await globalThis.engineeringStorage.bim.generateViewerBase64(modelos().map((m) => ({ name: m.arquivo_nome, base64: m.arquivo_base64 }))); alert(`Viewer aberto: ${result.output}`); } catch (e) { alert(e.message); } };
  document.querySelector('#importarBim')?.addEventListener('click', () => modal('Importar modelo BIM', '<label>Arquivo IFC ou manifesto JSON<input name="arquivo" type="file" accept=".ifc,.json" required /></label><label>Disciplina<input name="disciplina" /></label>', async (form) => { try { const file = form.get('arquivo'); const texto = file.name.toLowerCase().endsWith('.ifc') ? await file.slice(0, 4096).text() : await file.text(); const parsed = await lerManifestoBim(file); salvarModeloBim(db, obraSelecionada.id, { nome: file.name, arquivoNome: file.name, arquivoHash: hashTexto(texto), arquivoBase64: await base64Arquivo(file), disciplina: form.get('disciplina') || parsed.disciplina, elementos: parsed.elementos }); setObraSelecionada(buscarObra(db, obraSelecionada.id)); setObras(listarObras(db)); render(); } catch (e) { alert(e.message); } }));
  const analisar = async () => {
    const ms = modelos();
    if (ms.length !== 2) { alert('Para esta análise selecione exatamente dois modelos. Use um estudo independente para comparar outro par.'); return; }
    const button = document.querySelector('#analisarBim');
    if (button?.disabled) return;
    if (button) { button.disabled = true; button.textContent = 'Analisando...'; }
    try {
      const result = await executarAnaliseBim(ms, {
        analisarIfc: globalThis.engineeringStorage?.bim?.clashBase64,
        analisarManifestos: ([a,b]) => detectarConflitosBim(criarModeloBim(a), criarModeloBim(b), { modo: 'intersection', afastamento: .05 }),
        opcoes: { mode: 'intersection', clearance: .05, tolerance: .002 }
      });
      salvarAnaliseBim(db, obraSelecionada.id, { modeloAId: ms[0].id, modeloBId: ms[1].id, modo: 'intersection', afastamento: .05, conflitos: result.conflitos, status: result.status });
      setObraSelecionada(buscarObra(db, obraSelecionada.id)); setObras(listarObras(db)); render();
    } catch (error) {
      alert('Análise não concluída: ' + error.message);
      if (button) { button.disabled = false; button.textContent = 'Analisar modelos'; }
    }
  };
  document.querySelector('#analisarBim')?.addEventListener('click', analisar);
  document.querySelector('#bimFiltro')?.addEventListener('change', (e) => document.querySelectorAll('.bim-conflict').forEach((row) => { row.hidden = e.target.value !== 'todos' && row.dataset.status !== e.target.value; }));
  document.querySelectorAll('[data-bim-action]').forEach((button) => button.addEventListener('click', () => { const analiseId = button.dataset.analise; const indice = Number(button.dataset.indice); if (button.dataset.bimAction === 'pendencia') { salvarPendencia(db, obraSelecionada.id, { descricao: `Conflito BIM #${indice} da análise ${analiseId}`, prioridade: 'alta', origem: 'bim' }); } else atualizarConflitoBim(db, analiseId, indice, 'resolvido'); setObraSelecionada(buscarObra(db, obraSelecionada.id)); setObras(listarObras(db)); render(); }));
  enhanceBimUi({ db, obraSelecionada, setObraSelecionada, setObras, render });
}
