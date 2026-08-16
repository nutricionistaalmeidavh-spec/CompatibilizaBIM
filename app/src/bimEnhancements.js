import { atualizarConflitoBim, buscarObra, listarObras } from '../../storage/sqliteStore.js';
import { gerarPdfRelatorio } from './pdfTemplates.js';
import { explicarConflitoBim } from '../../src/bim/explanation.js';

function download(name, blob) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }

export function enhanceBimUi({ db, obraSelecionada, setObraSelecionada, setObras, render }) {
  const panel = document.querySelector('.bim-panel'); if (!panel) return;
  const conflicts = (obraSelecionada.bimAnalises ?? []).flatMap((analysis) => analysis.conflitos.map((conflict) => ({ ...conflict, analysisId: analysis.id })));
  panel.querySelectorAll('.bim-conflict').forEach((row, index) => { const info = explicarConflitoBim(conflicts[index] ?? {}); if (!row.querySelector('.conflict-explanation')) row.insertAdjacentHTML('afterbegin', `<span class="conflict-explanation"><b class="severity severity-${info.gravidade}">${info.gravidadeLabel}</b><small>${info.resumo} ${info.detalhe} ${info.localizacao}</small></span>`); });
  const progress = document.createElement('p'); progress.className = 'muted'; progress.id = 'bimProgress'; progress.textContent = 'Pronto para análise.'; panel.querySelector('.panel-head')?.after(progress);
  const cancel = document.createElement('button'); cancel.className = 'small'; cancel.textContent = 'Cancelar análise'; cancel.onclick = async () => { if (globalThis.engineeringStorage?.bim?.cancel) { await globalThis.engineeringStorage.bim.cancel(); progress.textContent = 'Análise cancelada.'; } }; panel.querySelector('.panel-head > div:last-child')?.append(cancel);
  if (globalThis.engineeringStorage?.bim?.onProgress) globalThis.engineeringStorage.bim.onProgress(({ percent, stage }) => { progress.textContent = `${percent}% — ${stage}`; });
  const filters = panel.querySelector('.bim-filters');
  if (filters) {
    const discipline = document.createElement('input'); discipline.placeholder = 'Disciplina'; filters.append(discipline);
    const severity = document.createElement('select'); severity.innerHTML = '<option value="todos">Gravidade</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option>'; filters.append(severity);
    const pdf = document.createElement('button'); pdf.className = 'small'; pdf.textContent = 'PDF'; filters.append(pdf);
    const apply = () => panel.querySelectorAll('.bim-conflict').forEach((row) => { const text = row.textContent.toLowerCase(); row.hidden = Boolean((discipline.value && !text.includes(discipline.value.toLowerCase())) || (severity.value !== 'todos' && !text.includes(severity.value))); });
    discipline.oninput = apply; severity.onchange = apply;
    pdf.onclick = () => { const conflitos = (obraSelecionada.bimAnalises ?? []).flatMap((a) => a.conflitos); const sections = { Resumo: [`Conflitos encontrados: ${conflitos.length}`, `Obra: ${obraSelecionada.nome}`], Conflitos: conflitos.map((c) => `#${c.indice}: ${c.aGlobalId} x ${c.bGlobalId} · ${c.status || 'aberto'}`) }; download(`relatorio-bim-${obraSelecionada.codigo}.pdf`, gerarPdfRelatorio(`Relatório BIM - ${obraSelecionada.nome}`, sections)); };
  }
  panel.querySelectorAll('[data-bim-action="resolver"]').forEach((button) => {
    for (const [action, label, status] of [['ignorar', 'Ignorar', 'ignorado'], ['reabrir', 'Reabrir', 'aberto']]) { const copy = button.cloneNode(true); copy.dataset.bimAction = action; copy.textContent = label; button.parentElement.append(copy); copy.onclick = () => { atualizarConflitoBim(db, copy.dataset.analise, Number(copy.dataset.indice), status); setObraSelecionada(buscarObra(db, obraSelecionada.id)); setObras(listarObras(db)); render(); }; }
  });
}
