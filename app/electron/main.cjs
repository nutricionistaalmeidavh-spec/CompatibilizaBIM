const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs'); const path = require('node:path'); const { spawn } = require('node:child_process');
const { convertDwg, cancelConversion } = require('./cbimRunner.cjs');
const { openStudioWindow, returnToMainWindow, listCbimWorkspaces, stopAllStudios } = require('./studioWindow.cjs');
const { createCbimApplication } = require('./cbimApplication.cjs');
const { p2Request } = require('./p2Bridge.cjs');
const { createJobQueue } = require('./cbimJobQueue.cjs');
const cbimConversionQueue = createJobQueue((context) => convertDwg(context));
const cbimApplication = createCbimApplication({
  convertDwg: async context => cbimConversionQueue.enqueue(context).promise,
  cancelConversion,
  listWorkspaces: listCbimWorkspaces,
  openStudio: openStudioWindow
});
// Alguns computadores sem driver gráfico compatível encerram o renderer ao iniciar.
// O Engenharia 360 continua funcional offline sem aceleração de hardware.
let activeBimProcess = null;
const { atomicSaveSqlite, readSqliteFile } = require('./databaseStore.cjs');
const databasePath = () => { const root = path.join(app.getPath('documents'), 'Engenharia360'); fs.mkdirSync(root, { recursive: true }); return path.join(root, 'engenharia360.sqlite'); };
ipcMain.on('engineering-db:load-sync', (event) => {
  try { const file = databasePath(); event.returnValue = fs.existsSync(file) ? readSqliteFile(file).toString('base64') : null; }
  catch (error) { event.returnValue = { ok: false, error: String(error.message || error) }; }
});
ipcMain.on('engineering-db:save-sync', (event, base64) => {
  try { atomicSaveSqlite(databasePath(), String(base64)); event.returnValue = true; }
  catch (error) { event.returnValue = { ok: false, error: String(error.message || error) }; }
});
ipcMain.handle('engineering-db:path', () => databasePath());
function runBimPython(args) {
  return new Promise((resolve, reject) => {
    const root = path.join(__dirname, '..');
    const packagedRoot = process.resourcesPath || root;
    const moduleRoot = fs.existsSync(path.join(packagedRoot, 'modules'))
      ? path.join(packagedRoot, 'modules') : path.join(root, 'modules');
    const packagedCli = path.join(packagedRoot, 'runtime', 'cbim-runtime.exe');
    const embeddedPython = path.join(packagedRoot, 'runtime', process.platform === 'win32' ? 'python.exe' : 'python');
    let program, commandArgs;
    const env = { ...process.env };
    if (fs.existsSync(packagedCli)) {
      program = packagedCli;
      const commands = {
        'compatibilizabim.viewer_cli': 'ifc-viewer',
        'compatibilizabim.bridge_cli': 'ifc-clash',
        'compatibilizabim.p2_workflow': 'p2',
        'compatibilizabim.cli': 'ifc-legacy'
      };
      if (args[0] === '-m') {
        const selected = commands[args[1]];
        if (!selected) return reject(new Error('Comando BIM não suportado pelo runtime empacotado: ' + args[1]));
        commandArgs = [selected, ...args.slice(2)];
      } else {
        commandArgs = ['ifc-legacy', ...args];
      }
    } else {
      program = fs.existsSync(embeddedPython) ? embeddedPython : (process.env.PYTHON || 'python');
      const pythonRoot = path.dirname(program);
      if (fs.existsSync(embeddedPython)) env.PYTHONHOME = pythonRoot;
      env.PYTHONPATH = [moduleRoot, path.join(pythonRoot, 'Lib', 'site-packages'), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter);
      commandArgs = args[0] === '-m' ? args : ['-m', 'compatibilizabim', ...args];
    }
    const child = spawn(program, commandArgs, { cwd: moduleRoot, env, windowsHide: true });
    activeBimProcess = child;
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > 8_000_000) child.kill();
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-200_000); });
    child.on('error', error => { activeBimProcess = null; reject(error); });
    child.on('close', code => {
      activeBimProcess = null;
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || 'Motor BIM encerrado com código ' + code));
    });
  });
}
ipcMain.handle('bim:p2', (_event, request) => p2Request(request, { documentsDir: app.getPath('documents'), runPython: runBimPython }));
ipcMain.handle('bim:generate-viewer', (_event, files, output) => runBimPython(['-m', 'compatibilizabim.viewer_cli', ...(files || []), '--out', output]));
ipcMain.handle('bim:generate-viewer-base64', async (_event, files) => { const root = path.join(app.getPath('documents'), 'Engenharia360', 'BIM', 'models'); fs.mkdirSync(root, { recursive: true }); const paths = []; for (const file of files || []) { const target = path.join(root, `${Date.now()}-${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_')}`); fs.writeFileSync(target, Buffer.from(String(file.base64), 'base64')); paths.push(target); } const output = path.join(root, `../viewer-${Date.now()}.html`); await runBimPython(['-m', 'compatibilizabim.viewer_cli', ...paths, '--out', output]); await shell.openPath(output); return { output, paths }; });
ipcMain.handle('bim:clash-base64', async (event, files, options = {}) => { event.sender.send('bim:progress', { percent: 10, stage: 'Preparando modelos IFC' }); const root = path.join(app.getPath('documents'), 'Engenharia360', 'BIM', 'models'); fs.mkdirSync(root, { recursive: true }); const paths = []; for (const file of files || []) { const target = path.join(root, `${Date.now()}-${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_')}`); fs.writeFileSync(target, Buffer.from(String(file.base64), 'base64')); paths.push(target); } event.sender.send('bim:progress', { percent: 30, stage: 'Processando geometria com IfcOpenShell' }); const result = await runBimPython(['-m', 'compatibilizabim.bridge_cli', paths[0], paths[1], '--mode', options.mode || 'intersection', '--tolerance', String(options.tolerance ?? .002), '--clearance', String(options.clearance ?? .05)]); event.sender.send('bim:progress', { percent: 100, stage: 'Análise concluída' }); return JSON.parse(result.stdout.trim()); });
ipcMain.handle('bim:clash', (_event, fileA, fileB, options = {}) => runBimPython([fileA, fileB, '--mode', options.mode || 'intersection', '--tolerance', String(options.tolerance ?? .002), '--clearance', String(options.clearance ?? .05), '--out', options.out || path.join(app.getPath('documents'), 'Engenharia360', 'bim-reports')]));
ipcMain.handle('cbim:conversion-jobs', () => cbimConversionQueue.snapshot());
ipcMain.handle('cbim:list-workspaces', () => cbimApplication.query('GetHistory', { documentsDir: app.getPath('documents') }));
ipcMain.handle('cbim:open-studio', (event, workspacePath) => cbimApplication.execute('OpenProject', {
  workspacePath,
  documentsDir: app.getPath('documents'),
  appSourceDir: path.join(__dirname, '..'),
  resourcesDir: process.resourcesPath,
  BrowserWindow,
  hostWindow: BrowserWindow.fromWebContents(event.sender),
  isPackaged: app.isPackaged
}));
ipcMain.handle('cbim:return-to-app', (event) => returnToMainWindow(BrowserWindow.fromWebContents(event.sender)));
ipcMain.handle('bim:convert-dwg-base64', async (event, input) => cbimApplication.execute('StartConversion', {
  input,
  documentsDir: app.getPath('documents'),
  appSourceDir: path.join(__dirname, '..'),
  resourcesDir: process.resourcesPath,
  isPackaged: app.isPackaged,
  onProgress: (progress) => { if (!event.sender.isDestroyed()) event.sender.send('bim:progress', progress); }
}));
ipcMain.handle('bim:cancel', async () => { const cbim = await cbimApplication.execute('CancelConversion', {}); if (!activeBimProcess) return cbim; activeBimProcess.kill(); activeBimProcess = null; return true; });

function runEngineeringMath(request) {
  return new Promise((resolve,reject) => {
    if(!request || typeof request !== 'object' || typeof request.expression !== 'string' ||
       request.expression.length > 160 || !['analyze','differentiate','integrate','solve'].includes(request.operation))
      return reject(new Error('Requisição matemática inválida.'));
    const projectRoot=path.join(__dirname,'..','..');
    const resources=app.isPackaged?process.resourcesPath:projectRoot;
    const exe=path.join(resources,'runtime','cbim-runtime.exe');
    const packaged=process.platform==='win32'&&fs.existsSync(exe);
    const python=packaged?exe:(process.env.PYTHON||'python');
    const args=packaged?['math-study']:['-m','compatibilizabim.engineering_math'];
    const moduleRoot=fs.existsSync(path.join(resources,'modules'))?path.join(resources,'modules'):path.join(projectRoot,'modules');
    const child=spawn(python,args,{
      cwd:moduleRoot,windowsHide:true,stdio:['pipe','pipe','pipe'],
      env:{...process.env,PYTHONPATH:[moduleRoot,process.env.PYTHONPATH||''].filter(Boolean).join(path.delimiter)}
    });
    let stdout='',stderr='',completed=false;
    const finish=(err,value)=>{
      if(completed)return;completed=true;clearTimeout(timer);
      if(err)reject(err);else resolve(value);
    };
    const timer=setTimeout(()=>{child.kill();finish(new Error('Cálculo excedeu 12 segundos.'));},12000);
    child.stdout.on('data',chunk=>{
      stdout+=chunk.toString('utf8');
      if(stdout.length>100000){child.kill();finish(new Error('Saída matemática excede limite.'));}
    });
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString('utf8')).slice(-3000);});
    child.on('error',err=>finish(err));
    child.on('close',code=>{
      if(code!==0)return finish(new Error(stderr.trim()||'Falha no motor matemático local.'));
      try{finish(null,JSON.parse(stdout));}catch{finish(new Error('Retorno matemático inválido.'));}
    });
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify(request));
  });
}
ipcMain.handle('math:calculate',(_event,request)=>runEngineeringMath(request));

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const dev = process.env.VITE_DEV_SERVER_URL; if (dev) await window.loadURL(dev); else await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('before-quit', stopAllStudios);
