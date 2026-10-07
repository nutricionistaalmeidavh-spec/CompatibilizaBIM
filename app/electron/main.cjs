const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs'); const path = require('node:path'); const { spawn } = require('node:child_process');
const { convertDwg, cancelConversion } = require('./cbimRunner.cjs');
const { openStudioWindow, listCbimWorkspaces, stopAllStudios } = require('./studioWindow.cjs');
// Alguns computadores sem driver gráfico compatível encerram o renderer ao iniciar.
// O Engenharia 360 continua funcional offline sem aceleração de hardware.
let activeBimProcess = null;
const databasePath = () => { const root = path.join(app.getPath('documents'), 'Engenharia360'); fs.mkdirSync(root, { recursive: true }); return path.join(root, 'engenharia360.sqlite'); };
ipcMain.on('engineering-db:load-sync', (event) => { const file = databasePath(); event.returnValue = fs.existsSync(file) ? fs.readFileSync(file).toString('base64') : null; });
ipcMain.on('engineering-db:save-sync', (event, base64) => { fs.writeFileSync(databasePath(), Buffer.from(String(base64), 'base64')); event.returnValue = true; });
ipcMain.handle('engineering-db:path', () => databasePath());
function runBimPython(args) { return new Promise((resolve, reject) => { const root = path.join(__dirname, '..'); const packagedRoot = process.resourcesPath || root; const moduleRoot = fs.existsSync(path.join(packagedRoot, 'modules')) ? path.join(packagedRoot, 'modules') : path.join(root, 'modules'); const bundled = path.join(packagedRoot, 'runtime', process.platform === 'win32' ? 'python.exe' : 'python'); const bundledExists = fs.existsSync(bundled); const python = bundledExists ? bundled : (process.env.PYTHON || 'python'); const pythonRoot = path.dirname(bundled); const env = { ...process.env, PYTHONHOME: bundledExists ? pythonRoot : process.env.PYTHONHOME, PYTHONPATH: `${moduleRoot};${path.join(pythonRoot, 'Lib', 'site-packages')}` }; const child = spawn(python, args[0] === '-m' ? args : ['-m', 'compatibilizabim', ...args], { cwd: moduleRoot, env, windowsHide: true }); activeBimProcess = child; let stdout = ''; let stderr = ''; child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; }); child.on('error', reject); child.on('close', (code) => { activeBimProcess = null; code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || stdout || `Backend BIM encerrou com código ${code}`)); }); }); }
ipcMain.handle('bim:generate-viewer', (_event, files, output) => runBimPython(['-m', 'compatibilizabim.viewer_cli', ...(files || []), '--out', output]));
ipcMain.handle('bim:generate-viewer-base64', async (_event, files) => { const root = path.join(app.getPath('documents'), 'Engenharia360', 'BIM', 'models'); fs.mkdirSync(root, { recursive: true }); const paths = []; for (const file of files || []) { const target = path.join(root, `${Date.now()}-${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_')}`); fs.writeFileSync(target, Buffer.from(String(file.base64), 'base64')); paths.push(target); } const output = path.join(root, `../viewer-${Date.now()}.html`); await runBimPython(['-m', 'compatibilizabim.viewer_cli', ...paths, '--out', output]); await shell.openPath(output); return { output, paths }; });
ipcMain.handle('bim:clash-base64', async (event, files, options = {}) => { event.sender.send('bim:progress', { percent: 10, stage: 'Preparando modelos IFC' }); const root = path.join(app.getPath('documents'), 'Engenharia360', 'BIM', 'models'); fs.mkdirSync(root, { recursive: true }); const paths = []; for (const file of files || []) { const target = path.join(root, `${Date.now()}-${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_')}`); fs.writeFileSync(target, Buffer.from(String(file.base64), 'base64')); paths.push(target); } event.sender.send('bim:progress', { percent: 30, stage: 'Processando geometria com IfcOpenShell' }); const result = await runBimPython(['-m', 'compatibilizabim.bridge_cli', paths[0], paths[1], '--mode', options.mode || 'intersection', '--tolerance', String(options.tolerance ?? .002), '--clearance', String(options.clearance ?? .05)]); event.sender.send('bim:progress', { percent: 100, stage: 'Análise concluída' }); return JSON.parse(result.stdout.trim()); });
ipcMain.handle('bim:clash', (_event, fileA, fileB, options = {}) => runBimPython([fileA, fileB, '--mode', options.mode || 'intersection', '--tolerance', String(options.tolerance ?? .002), '--clearance', String(options.clearance ?? .05), '--out', options.out || path.join(app.getPath('documents'), 'Engenharia360', 'bim-reports')]));
ipcMain.handle('cbim:list-workspaces', () => listCbimWorkspaces(app.getPath('documents')));
ipcMain.handle('cbim:open-studio', (_event, workspacePath) => openStudioWindow({
  workspacePath,
  documentsDir: app.getPath('documents'),
  appSourceDir: path.join(__dirname, '..'),
  resourcesDir: process.resourcesPath,
  BrowserWindow,
  isPackaged: app.isPackaged
}));
ipcMain.handle('bim:convert-dwg-base64', async (event, input) => convertDwg({
  input,
  documentsDir: app.getPath('documents'),
  appSourceDir: path.join(__dirname, '..'),
  resourcesDir: process.resourcesPath,
  isPackaged: app.isPackaged,
  onProgress: (progress) => { if (!event.sender.isDestroyed()) event.sender.send('bim:progress', progress); }
}));
ipcMain.handle('bim:cancel', () => { const cbim = cancelConversion(); if (!activeBimProcess) return cbim; activeBimProcess.kill(); activeBimProcess = null; return true; });
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const dev = process.env.VITE_DEV_SERVER_URL; if (dev) await window.loadURL(dev); else await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('before-quit', stopAllStudios);
