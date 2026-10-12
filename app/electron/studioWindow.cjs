'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const activeStudioSessions = new Set();
const hostedStudioSessions = new WeakMap();

function returnToMainWindow(window) {
  const session = window && hostedStudioSessions.get(window);
  if (!session) throw new Error('Não há revisão aberta nesta janela.');
  if (!window.webContents.getURL().startsWith(session.origin + '/')) throw new Error('Origem de revisão inválida.');
  return session.restore();
}


function workspaceRoot(documentsDir) {
  return path.join(documentsDir, 'Engenharia360', 'CBIM', 'jobs');
}

function resolveCbimWorkspace(documentsDir, candidate) {
  const rootPath = workspaceRoot(documentsDir);
  if (!fs.existsSync(rootPath) || !fs.existsSync(candidate)) throw new Error('Workspace CBIM não encontrada');
  const root = fs.realpathSync(rootPath);
  const target = fs.realpathSync(path.resolve(candidate));
  const relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) ||
      relative.split(path.sep).length < 2 || path.basename(target) !== 'studio-workspace') {
    throw new Error('Workspace CBIM fora do diretório autorizado');
  }
  if (!fs.statSync(path.join(target, 'workspace.json')).isFile()) {
    throw new Error('Workspace CBIM sem manifesto');
  }
  return target;
}

function listCbimWorkspaces(documentsDir) {
  const root = workspaceRoot(documentsDir);
  if (!fs.existsSync(root)) return [];
  const list = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('job-')) continue;
    const candidate = path.join(root, entry.name, 'studio-workspace');
    try {
      const resolved = resolveCbimWorkspace(documentsDir, candidate);
      const manifest = JSON.parse(fs.readFileSync(path.join(resolved, 'workspace.json'), 'utf8'));
      list.push({
        path: resolved, job: entry.name, project_id: String(manifest.project_id || ''),
        project_name: String(manifest.project_name || 'Projeto sem nome'),
        revision: Number(manifest.revision || 0),
        updated_at: String(manifest.updated_at || '')
      });
    } catch {
      // Ignore half-written or invalid workspaces, never infer a successful conversion.
    }
  }
  return list.sort((a, b) => b.job.localeCompare(a.job)).slice(0, 50);
}

function parseStudioReady(line) {
  const prefix = 'CBIM_STUDIO_READY ';
  if (!String(line).startsWith(prefix)) throw new Error('Handshake de Studio inválido');
  const info = JSON.parse(line.slice(prefix.length));
  if (info.host !== '127.0.0.1') throw new Error('Studio só pode abrir em loopback');
  if (!Number.isInteger(info.port) || info.port < 1024 || info.port > 65535) throw new Error('Porta local inválida');
  if (typeof info.token !== 'string' || info.token.length < 8) throw new Error('Sessão do Studio sem token válido');
  return info;
}

function pythonStudioCommand({ appSourceDir, resourcesDir }) {
  const packaged = path.join(resourcesDir || '', 'runtime', 'cbim-runtime.exe');
  const integrated = path.join(resourcesDir || '', 'integrations', 'cbim-2.1.0');
  const fromRepo = path.resolve(appSourceDir, '..', 'integrations', 'cbim-2.1.0');
  const sourceRoot = fs.existsSync(path.join(integrated, 'compatibilizabim-core', 'src')) ? integrated : fromRepo;
  const pythonPath = [
    path.join(sourceRoot, 'compatibilizabim-core', 'src'),
    path.join(sourceRoot, 'cbim-sdk', 'python', 'src'),
    process.env.PYTHONPATH
  ].filter(Boolean).join(path.delimiter);
  if (fs.existsSync(packaged)) {
    return { program: packaged, prefix: ['studio'], env: { ...process.env } };
  }
  const py = path.join(resourcesDir || '', 'runtime', 'python.exe');
  return {
    program: fs.existsSync(py) ? py : (process.env.PYTHON || 'python'),
    prefix: ['-m', 'compatibilizabim_core.desktop.p1_launcher'],
    env: { ...process.env, PYTHONPATH: pythonPath }
  };
}

function studioLicenseArguments({ isPackaged, resourcesDir, documentsDir, mode = process.env.CBIM_STUDIO_LICENSE_MODE }) {
  if (!mode || mode === 'free') return [];
  if (mode !== 'commercial') throw new Error('Modo de licença CBIM inválido: escolha free ou commercial.');
  if (!isPackaged) return [];
  const publicKey = path.join(resourcesDir, 'license', 'public.pem');
  const customer = path.join(documentsDir, 'Engenharia360', 'CBIM', 'license', 'customer.json');
  const license = path.join(documentsDir, 'Engenharia360', 'CBIM', 'license', 'license.json');
  if (![publicKey, customer, license].every(p => fs.existsSync(p))) {
    throw new Error('Modo comercial: importe a licença offline e configure a chave pública do emissor.');
  }
  return ['--require-license', '--public-key', publicKey, '--customer', customer, '--license', license];
}

async function openStudioWindow({ workspacePath, documentsDir, appSourceDir, resourcesDir, BrowserWindow, isPackaged, hostWindow = null, startProcess = spawn }) {
  if (hostWindow && hostedStudioSessions.has(hostWindow)) throw new Error('Uma revisão já está aberta nesta janela.');
  const workspace = resolveCbimWorkspace(documentsDir, workspacePath);
  const command = pythonStudioCommand({ appSourceDir, resourcesDir });
  const packagedUi = path.join(resourcesDir || '', 'studio-ui');
  const developmentUi = path.join(appSourceDir, 'dist');
  command.env.CBIM_STUDIO_UI_DIR = isPackaged ? packagedUi : developmentUi;
  const args = [...command.prefix, 'serve', '--workspace', workspace];
  args.push(...studioLicenseArguments({ isPackaged, resourcesDir, documentsDir }));
  return new Promise((resolve, reject) => {
    let settled = false;
    let opened = false;
    let pending = '';
    let stderr = '';
    let win = null;
    const child = startProcess(command.program, args, {
      cwd: workspace, env: command.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
    });
    activeStudioSessions.add(child);
    const timeout = setTimeout(() => fail(new Error('Tempo de inicialização do Studio excedido')), 30000);
    const stop = () => {
      if (!child.killed) {
        try { child.stdin.write('quit\n'); } catch {}
        setTimeout(() => { if (!child.killed) child.kill(); }, 3000).unref?.();
      }
    };
    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      stop();
      reject(error);
    }
    child.stderr.on('data', b => { stderr = (stderr + b.toString()).slice(-7000); });
    child.on('error', fail);
    child.stdout.on('data', b => {
      pending += b.toString();
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('CBIM_STUDIO_READY ')) continue;
        let ready;
        try { ready = parseStudioReady(line); }
        catch (e) { fail(e); return; }
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        opened = true;
        const origin = 'http://127.0.0.1:' + ready.port;
        win = hostWindow || new BrowserWindow({
          width: 1420, height: 920, autoHideMenuBar: true,
          title: 'CompatibilizaBIM Studio',
          webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
        });
        const homeUrl = hostWindow ? win.webContents.getURL() : '';
        const guard = (event, url) => {
          if (!url.startsWith(origin + '/')) event.preventDefault();
        };
        win.webContents.on('will-navigate', guard);
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        win.on('closed', stop);
        if (hostWindow) {
          const restore = () => {
            const session = hostedStudioSessions.get(win);
            if (session) {
              hostedStudioSessions.delete(win);
              win.webContents.removeListener('will-navigate', guard);
            }
            stop();
            if (!win.isDestroyed()) return win.loadURL(homeUrl);
            return Promise.resolve();
          };
          hostedStudioSessions.set(win, { origin, restore });
        }
        win.loadURL(origin + '/?token=' + encodeURIComponent(ready.token))
          .catch(() => {
            if (hostWindow && hostedStudioSessions.has(win)) {
              hostedStudioSessions.get(win).restore().catch(() => {});
            } else if (!hostWindow && win && !win.isDestroyed()) {
              win.close();
            }
          });
        resolve({ workspace, port: ready.port });
      }
    });
    child.on('close', code => {
      activeStudioSessions.delete(child);
      clearTimeout(timeout);
      if (!opened) fail(new Error('Studio não iniciou: ' + (stderr.trim() || 'código ' + code)));
      else if (win && !win.isDestroyed()) {
        if (hostWindow) {
          if (hostedStudioSessions.has(win)) hostedStudioSessions.get(win).restore().catch(() => {});
        } else win.close();
      }
    });
  });
}

function stopAllStudios() {
  for (const child of activeStudioSessions) {
    try { child.stdin.write('quit\n'); } catch {}
    child.kill();
  }
  activeStudioSessions.clear();
}

module.exports = { resolveCbimWorkspace, listCbimWorkspaces, parseStudioReady, pythonStudioCommand, openStudioWindow, returnToMainWindow, studioLicenseArguments, stopAllStudios };
