export function wireAdvancedEvents(ctx) {
  const { db, obraSelecionada, render, atualizarRdo, excluirRdo, aprovarRdo, esc, modal } = ctx;
  if (!obraSelecionada) return;
  document.querySelectorAll('.rdo-panel .row').forEach((row, index) => {
    const rdo = obraSelecionada.rdos?.[index]; if (!rdo) return;
    const actions = document.createElement('span'); actions.className = 'row-actions';
    actions.innerHTML = `<small class="priority">${esc(rdo.status_aprovacao ?? 'rascunho')}</small><button class="small">Editar</button><button class="small">Aprovar</button><button class="small danger">Excluir</button>`; row.appendChild(actions);
    const [edit, approve, remove] = actions.querySelectorAll('button');
    edit.onclick = () => modal('Editar RDO', `<label>Data<input name="data" type="date" required value="${esc(rdo.data)}" /></label><label>Turno<input name="turno" value="${esc(rdo.turno ?? '')}" /></label><label>Responsável<input name="responsavel" required value="${esc(rdo.responsavel)}" /></label><label>Serviços<textarea name="servicos">${esc((rdo.servicosExecutados ?? []).map((item) => item.descricao).join('\n'))}</textarea></label><label>Ocorrências<textarea name="ocorrencias">${esc((rdo.ocorrencias ?? []).map((item) => item.descricao).join('\n'))}</textarea></label><label>Observações<textarea name="observacoes">${esc(rdo.observacoes ?? '')}</textarea></label>`, (form) => { const linhas = (name) => String(form.get(name) ?? '').split('\n').map((item) => item.trim()).filter(Boolean); atualizarRdo(db, rdo.id, { ...rdo, data: form.get('data'), turno: form.get('turno'), responsavel: form.get('responsavel'), servicosExecutados: linhas('servicos').map((descricao) => ({ descricao })), ocorrencias: linhas('ocorrencias').map((descricao) => ({ descricao })), observacoes: form.get('observacoes') }); render(); });
    approve.onclick = () => { const nome = prompt('Nome de quem aprova:'); if (nome) { aprovarRdo(db, rdo.id, nome); render(); } };
    remove.onclick = () => { const confirmacao = prompt('Digite EXCLUIR para apagar este RDO:'); try { excluirRdo(db, rdo.id, confirmacao); render(); } catch (error) { alert(error.message); } };
  });
  if (!document.querySelector('.timeline')) {
    const timeline = document.createElement('div'); timeline.className = 'panel timeline';
    timeline.innerHTML = `<div class="panel-head"><h3>Cronograma visual</h3><select id="filtroEtapa"><option value="todas">Todas as etapas</option>${(obraSelecionada.etapas ?? []).map((e) => `<option value="${esc(e.id)}">${esc(e.nome)}</option>`).join('')}</select></div><div class="timeline-bars">${(obraSelecionada.etapas ?? []).map((e) => `<div class="timeline-row" data-stage="${esc(e.id)}"><span>${esc(e.nome)}</span><i><b style="width:${Math.min(Number(e.percentual_concluido), 100)}%"></b></i><strong>${Number(e.percentual_concluido).toFixed(0)}%</strong></div>`).join('')}</div>`;
    document.querySelector('.workspace')?.appendChild(timeline);
    document.querySelector('#filtroEtapa')?.addEventListener('change', (event) => document.querySelectorAll('.timeline-row').forEach((bar) => { bar.style.display = event.target.value === 'todas' || bar.dataset.stage === event.target.value ? 'grid' : 'none'; }));
  }
}
