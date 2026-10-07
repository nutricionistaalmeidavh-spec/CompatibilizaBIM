from __future__ import annotations

import json
import os
import tempfile
import secrets
import threading
import webbrowser
from uuid import uuid4
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from cbim_sdk import CBIMProject
from compatibilizabim_core.commercial.workspace import WorkspaceStore
from compatibilizabim_core.commercial.recovery import AutosaveManager
from compatibilizabim_core.product.models import ImportPlan
from compatibilizabim_core.product.reporting import build_conversion_report
from compatibilizabim_core.product.studio import write_studio

MAX_PROJECT_BYTES = 16 * 1024 * 1024

HISTORY_CONTROLS = """<script>
(function() {
  if (location.search) history.replaceState({}, '', location.pathname);
  const button = document.querySelector('[data-page="history"]');
  if (!button) return;
  const target = document.getElementById('historyRows');
  const status = document.getElementById('historyStatus');
  async function request(path, options) {
    const response = await fetch(path, {...options, credentials:'same-origin'});
    const text = await response.text();
    if (!response.ok) throw new Error(text || 'Falha ao consultar histórico');
    return JSON.parse(text);
  }
  async function loadHistory() {
    status.textContent = 'Carregando histórico...';
    target.replaceChildren();
    try {
      const data = await request('/api/history');
      status.textContent = 'Revisão atual: ' + data.revision + ' · ' + data.snapshots.length + ' revisão(ões) anterior(es)';
      if (!data.snapshots.length) {
        const p = document.createElement('p');
        p.textContent = 'Nenhuma revisão anterior. Salve uma alteração para criar o primeiro registro.';
        target.append(p);
      }
      data.snapshots.forEach(snapshot => {
        const row = document.createElement('div');
        row.className = 'source';
        const name = document.createElement('strong');
        name.textContent = snapshot.name;
        const detail = document.createElement('p');
        detail.className = 'muted';
        detail.textContent = new Date(snapshot.modified_at).toLocaleString('pt-BR');
        const restore = document.createElement('button');
        restore.className = 'action';
        restore.textContent = 'Restaurar esta revisão';
        restore.onclick = async () => {
          if (!confirm('Restaurar esta revisão? A versão atual será preservada no histórico.')) return;
          restore.disabled = true;
          restore.textContent = 'Restaurando...';
          try {
            const result = await request('/api/restore', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({snapshot:snapshot.name})});
            alert('Revisão ' + result.revision + ' restaurada. A página será atualizada para mostrar os dados efetivos.');
            location.reload();
          } catch (e) {
            restore.disabled = false;
            restore.textContent = 'Tentar novamente';
            status.textContent = 'Falha na restauração: ' + e.message;
          }
        };
        row.append(name, detail, restore);
        target.append(row);
      });
      const audit = await request('/api/audit').catch(() => ({items:[]}));
      const auditTarget = document.getElementById('auditRows');
      audit.items.slice(-50).reverse().forEach(entry => { const row=document.createElement('div'); row.className='source'; const title=document.createElement('strong'); title.textContent=entry.action; const detail=document.createElement('p'); detail.className='muted'; detail.textContent=new Date(entry.timestamp).toLocaleString('pt-BR')+' · '+entry.entity_type+' · '+entry.entity_id; row.append(title,detail); auditTarget.append(row); });
      if (!audit.items.length) auditTarget.textContent='Nenhuma ação auditável registrada ainda.';
      if (data.recovery && data.recovery.length) {
        const recovery = document.createElement('div');
        recovery.className = 'source recovery-card';
        const heading = document.createElement('strong');
        heading.textContent = 'Recuperação disponível';
        const detail = document.createElement('p');
        detail.className = 'muted';
        detail.textContent = 'Encontramos uma versão salva automaticamente antes do encerramento inesperado.';
        const recover = document.createElement('button');
        recover.className = 'action primary';
        recover.textContent = 'Recuperar versão mais recente';
        recover.onclick = async () => {
          if (!confirm('Recuperar a versão automática mais recente? A versão atual será preservada no histórico.')) return;
          recover.disabled = true;
          recover.textContent = 'Recuperando...';
          try {
            const result = await request('/api/recover', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({candidate:data.recovery[0].id})});
            alert('Projeto recuperado na revisão ' + result.revision + '.');
            location.reload();
          } catch (e) {
            recover.disabled = false;
            recover.textContent = 'Tentar novamente';
            status.textContent = 'Falha na recuperação: ' + e.message;
          }
        };
        recovery.append(heading, detail, recover);
        target.prepend(recovery);
      }
    } catch (e) { status.textContent = 'Histórico indisponível: ' + e.message; }
  }
  button.addEventListener('click', loadHistory);
})();
</script>"""



PRODUCTIVITY_CONTROLS = """<script>
(function(){
  const review=document.getElementById('review');
  const side=review&&review.querySelector('.side');
  if(side){
    const inspector=document.createElement('section'); inspector.className='card'; inspector.id='elementInspector';
    inspector.innerHTML='<strong>Inspector do elemento</strong><p class="muted">Selecione um elemento para ver origem, propriedades e anotações.</p>';
    side.prepend(inspector);
  }
  async function json(path,options){
    const response=await fetch(path,{credentials:'same-origin',...options});
    const data=await response.json().catch(()=>({error:'Resposta inválida'}));
    if(!response.ok) throw new Error(data.error||'Falha na operação');
    return data;
  }
  async function inspect(){
    const box=document.getElementById('elementInspector'); if(!box||typeof selected==='undefined'||!selected)return;
    const element=project.elements.find(item=>item.id===selected); if(!element)return;
    const notes=await json('/api/annotations').catch(()=>({items:[]}));
    const related=notes.items.filter(note=>note.element_id===element.id);
    box.replaceChildren();
    const title=document.createElement('strong'); title.textContent=element.name||element.type;
    const meta=document.createElement('p'); meta.className='muted'; meta.textContent=element.id+' · '+stateLabels[element.review_state]+' · '+Math.round(element.confidence*100)+'%';
    const origin=document.createElement('p'); origin.className='muted'; origin.textContent='Origem: '+((element.source_refs||[]).map(ref=>ref.layer||ref.entity_id).filter(Boolean).join(', ')||'não informada');
    const props=document.createElement('pre'); props.className='inspector-props'; props.textContent=JSON.stringify(element.properties||{},null,2);
    const form=document.createElement('form'); form.innerHTML='<label class="field"><span>Comentário</span><textarea rows="2" required placeholder="Registrar observação da revisão"></textarea></label><button class="action" type="submit">Adicionar comentário</button>';
    const list=document.createElement('div'); list.className='annotation-list';
    related.forEach(note=>{const row=document.createElement('p');row.className='muted';row.textContent=note.text+' · '+note.author;list.append(row)});
    form.onsubmit=async event=>{event.preventDefault();const input=form.querySelector('textarea');await json('/api/annotations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({element_id:element.id,text:input.value,tags:['revisão'],author:'local'})});input.value='';inspect()};
    box.append(title,meta,origin,props,form,list);
  }
  const originalSelect=window.selectElement;
  window.selectElement=function(node){originalSelect(node);inspect()};
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();saveWorkspaceProject()}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo()}
    else if(event.key==='Escape'){selected=null;draw()}
    else if(event.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){event.preventDefault();document.getElementById('elementSearch')?.focus()}
  });
  const report=document.getElementById('report');
  if(report){
    const button=document.createElement('button');button.className='action';button.textContent='Exportar elementos CSV';
    button.onclick=async()=>{const data=await json('/api/export/elements');const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[data.columns.join(','),...data.rows.map(row=>data.columns.map(k=>quote(row[k])).join(','))].join('\\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='elementos-cbim.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
    report.querySelector('.title>div:last-child')?.append(' ',button);
  }
})();
</script>"""

def _studio_with_history(html: str) -> str:
    html = html.replace('</nav>', '<button data-page="history">6. Histórico</button></nav>', 1)
    html = html.replace('</main>', '<section id="history" class="page"><div class="title"><div><h1>Histórico e recuperação</h1><p class="muted">Revise versões anteriores; restauração sempre preserva o estado atual.</p></div></div><p id="historyStatus" role="status" aria-live="polite"></p><div id="historyRows"></div><h2>Atividade auditável</h2><div id="auditRows"></div></section></main>', 1)
    return html.replace('</body>', HISTORY_CONTROLS + PRODUCTIVITY_CONTROLS + '</body>', 1)


class DesktopApplication:
    def __init__(self, workspace: str | Path, *, session_token: str | None = None):
        self.store = WorkspaceStore(workspace)
        self.autosave = AutosaveManager(self.store)
        self.session_token = session_token

    def generate_studio(self) -> Path:
        project = self.store.load_project()
        plan = self.store.load_import_plan()
        report = build_conversion_report(project, import_plan=plan)
        out = self.store.root / 'desktop' / 'studio.html'
        out.parent.mkdir(exist_ok=True)
        write_studio(project, plan, report, out)
        out.write_text(_studio_with_history(out.read_text(encoding='utf-8')), encoding='utf-8')
        return out

    def status_payload(self) -> dict:
        return self.store.status().model_dump(mode='json')

    def canonical_payload(self) -> dict:
        return self.store.canonical_state().model_dump(mode='json')

    def recovery_payload(self) -> list[dict]:
        return [{
            'id': c.sha256,
            'created_at': c.created_at.isoformat(),
            'sha256': c.sha256,
            'project_id': c.project_id,
            'project_name': c.project_name,
        } for c in self.autosave.recovery_candidates()]

    def history_payload(self) -> dict:
        snaps = sorted((self.store.root / 'revisions').glob('r*.cbim.json'), reverse=True)
        snapshots = [{'name': p.name, 'modified_at': datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat(), 'bytes': p.stat().st_size} for p in snaps]
        return {'revision': self.store.status().revision, 'snapshots': snapshots, 'recovery': self.recovery_payload()}

    def save_project_payload(self, raw: bytes) -> dict:
        project = CBIMProject.model_validate_json(raw)
        current = self.store.load_project()
        if current.id != project.id:
            raise ValueError('Projeto não corresponde a este workspace')
        self.autosave.autosave(current)
        self.store.create_revision_snapshot('before-save')
        self.store.save_project(project)
        return self.status_payload()

    def save_workspace_payload(self, raw: bytes) -> dict:
        data = json.loads(raw)
        project = CBIMProject.model_validate(data.get('project'))
        plan = ImportPlan.model_validate(data.get('plan'))
        current = self.store.load_project()
        if current.id != project.id:
            raise ValueError('Projeto não corresponde a este workspace')
        if plan.config.project_name.strip() != project.name.strip():
            raise ValueError('Nome do projeto e configuração devem ser iguais')
        self.autosave.autosave(current)
        self.store.create_revision_snapshot('before-save')
        self.store.save_import_plan(plan)
        self.store.save_config(plan.config)
        self.store.save_project(project)
        return self.status_payload()

    def restore_snapshot(self, name: str) -> dict:
        if not name or '/' in name or '\\' in name or not name.startswith('r') or not name.endswith('.cbim.json'):
            raise ValueError('Identificador de revisão inválido')
        target = self.store.root / 'revisions' / name
        if not target.is_file():
            raise ValueError('Revisão solicitada não foi encontrada')
        project = CBIMProject.model_validate_json(target.read_text(encoding='utf-8'))
        current = self.store.load_project()
        if project.id != current.id:
            raise ValueError('Revisão pertence a outro projeto')
        self.autosave.autosave(current)
        self.store.create_revision_snapshot('before-restore')
        self.store.save_project(project)
        return self.status_payload()

    def recover_autosave(self, candidate_id: str) -> dict:
        candidates = self.autosave.recovery_candidates()
        candidate = next((item for item in candidates if secrets.compare_digest(item.sha256, candidate_id)), None)
        if candidate is None:
            raise ValueError('Autosave solicitado não foi encontrado')
        project = CBIMProject.model_validate_json(Path(candidate.path).read_text(encoding='utf-8'))
        current = self.store.load_project()
        if project.id != current.id:
            raise ValueError('Autosave pertence a outro projeto')
        self.store.create_revision_snapshot('before-recovery')
        self.store.save_project(project)
        self.autosave.clear_recovery_candidates()
        return self.status_payload()


    def _read_aux_items(self, name: str) -> list[dict]:
        path = self.store.root / 'project' / name
        if not path.exists():
            return []
        data = json.loads(path.read_text(encoding='utf-8'))
        return list(data.get('items') or [])

    def _write_aux_items(self, name: str, items: list[dict]) -> None:
        path = self.store.root / 'project' / name
        payload = json.dumps({'items': items}, ensure_ascii=False, indent=2)
        fd, tmp = tempfile.mkstemp(prefix=f'.{name}.', suffix='.tmp', dir=path.parent)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                stream.write(payload); stream.flush(); os.fsync(stream.fileno())
            os.replace(tmp, path)
        finally:
            if os.path.exists(tmp): os.unlink(tmp)

    def _audit(self, action: str, entity_type: str, entity_id: str, metadata: dict | None = None) -> None:
        items = self._read_aux_items('audit-log.json')
        items.append({'id': uuid4().hex, 'timestamp': datetime.now(timezone.utc).isoformat(), 'action': action,
                      'entity_type': entity_type, 'entity_id': entity_id, 'metadata': metadata or {}})
        self._write_aux_items('audit-log.json', items[-2000:])

    def annotations_payload(self) -> dict:
        return {'items': self._read_aux_items('annotations.json')}

    def save_annotation_payload(self, raw: bytes) -> dict:
        data = json.loads(raw)
        element_id = str(data.get('element_id') or '').strip()
        if element_id not in {element.id for element in self.store.load_project().elements}:
            raise ValueError('Anotação deve referenciar um elemento CBIM existente')
        text = str(data.get('text') or '').strip()
        if not text:
            raise ValueError('Informe o texto da anotação')
        item = {'id': uuid4().hex, 'element_id': element_id, 'text': text,
                'tags': [str(tag)[:80] for tag in list(data.get('tags') or [])[:20]],
                'author': str(data.get('author') or 'local')[:120],
                'created_at': datetime.now(timezone.utc).isoformat()}
        items = self._read_aux_items('annotations.json')
        items.append(item)
        self._write_aux_items('annotations.json', items)
        self._audit('annotation.created', 'element', element_id, {'annotation_id': item['id']})
        return item

    def audit_payload(self) -> dict:
        return {'items': self._read_aux_items('audit-log.json')}

    def export_payload(self, dataset: str) -> dict:
        if dataset != 'elements':
            raise ValueError('Conjunto de exportação não suportado')
        project = self.store.load_project()
        columns = ['id', 'type', 'name', 'review_state', 'confidence', 'storey_id']
        rows = [{key: getattr(element, key, None) for key in columns} for element in project.elements]
        return {'project_id': project.id, 'dataset': dataset, 'columns': columns, 'rows': rows}

    def handler(self):
        application = self

        class Handler(BaseHTTPRequestHandler):
            def _send(self, code: int, content_type: str, body: bytes, *, cookie: bool = False):
                self.send_response(code)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Cache-Control', 'no-store')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('Referrer-Policy', 'no-referrer')
                self.send_header('X-Frame-Options', 'DENY')
                self.send_header('Content-Security-Policy', "default-src 'none'; connect-src 'self'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'")
                if cookie and application.session_token:
                    self.send_header('Set-Cookie', f'cbim_studio_session={application.session_token}; HttpOnly; SameSite=Strict; Path=/')
                self.end_headers()
                self.wfile.write(body)

            def _authorized(self) -> bool:
                if application.session_token is None:
                    return True
                cookies = SimpleCookie()
                try:
                    cookies.load(self.headers.get('Cookie', ''))
                    value = cookies['cbim_studio_session'].value if 'cbim_studio_session' in cookies else ''
                except Exception:
                    return False
                return secrets.compare_digest(value, application.session_token)

            def _json(self, code: int, obj: dict | list):
                self._send(code, 'application/json; charset=utf-8', json.dumps(obj, ensure_ascii=False).encode('utf-8'))

            def do_GET(self):
                route = urlparse(self.path)
                allow_cookie = False
                if route.path == '/' and application.session_token:
                    provided = parse_qs(route.query).get('token', [''])[0]
                    allow_cookie = secrets.compare_digest(provided, application.session_token)
                if not self._authorized() and not allow_cookie:
                    return self._json(403, {'error': 'A sessão do Studio não foi autenticada'})
                if route.path == '/':
                    self._send(200, 'text/html; charset=utf-8', application.generate_studio().read_bytes(), cookie=allow_cookie)
                elif route.path == '/api/status':
                    self._json(200, application.status_payload())
                elif route.path == '/api/canonical':
                    self._json(200, application.canonical_payload())
                elif route.path == '/api/recovery':
                    self._json(200, application.recovery_payload())
                elif route.path == '/api/history':
                    self._json(200, application.history_payload())
                elif route.path == '/api/annotations':
                    self._json(200, application.annotations_payload())
                elif route.path == '/api/audit':
                    self._json(200, application.audit_payload())
                elif route.path == '/api/export/elements':
                    self._json(200, application.export_payload('elements'))
                else:
                    self._send(404, 'text/plain', b'not found')

            def do_POST(self):
                if not self._authorized():
                    return self._json(403, {'error': 'Sessão inválida'})
                origin = self.headers.get('Origin')
                if origin and origin != f'http://{self.headers.get("Host", "")}':
                    return self._json(403, {'error': 'Origem não autorizada'})
                route = urlparse(self.path).path
                if route not in ('/api/project', '/api/workspace', '/api/restore', '/api/recover', '/api/annotations'):
                    return self._json(404, {'error': 'Rota não encontrada'})
                try:
                    n = int(self.headers.get('Content-Length', '-1'))
                    if n < 0:
                        return self._json(411, {'error': 'Informe Content-Length'})
                    if n > MAX_PROJECT_BYTES:
                        return self._json(413, {'error': 'Arquivo excede limite seguro de 16 MB'})
                    raw = self.rfile.read(n)
                    if len(raw) != n:
                        return self._json(400, {'error': 'Upload incompleto'})
                    if route == '/api/project':
                        payload = application.save_project_payload(raw)
                    elif route == '/api/annotations':
                        payload = application.save_annotation_payload(raw)
                    elif route == '/api/workspace':
                        payload = application.save_workspace_payload(raw)
                    elif route == '/api/recover':
                        data = json.loads(raw)
                        payload = application.recover_autosave(str(data.get('candidate') or ''))
                    else:
                        data = json.loads(raw)
                        payload = application.restore_snapshot(str(data.get('snapshot') or ''))
                    self._json(200, payload)
                except Exception as exc:
                    self._json(400, {'error': str(exc)})

            def log_message(self, format, *args):
                return

        return Handler

    def start(self, *, host='127.0.0.1', port=0, open_browser=False):
        if host not in ('127.0.0.1', '::1', 'localhost'):
            raise ValueError('Studio local aceita somente loopback')
        server = ThreadingHTTPServer((host, port), self.handler())
        if open_browser:
            webbrowser.open(f'http://{host}:{server.server_address[1]}/')
        return server


def serve_workspace(workspace: str | Path, *, host='127.0.0.1', port=8765, open_browser=True):
    application = DesktopApplication(workspace)
    application.autosave.begin_session()
    server = application.start(host=host, port=port, open_browser=open_browser)
    try:
        server.serve_forever()
    finally:
        application.autosave.mark_clean_shutdown()
        server.server_close()
