
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {EventEmitter} = require('node:events');
const {openStudioWindow,returnToMainWindow} = require('../app/electron/studioWindow.cjs');

test('review reuses existing BrowserWindow and restores previous app renderer safely',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cbim-hosted-window-'));
  const workspace=path.join(root,'Engenharia360','CBIM','jobs','job-123','studio-workspace');
  fs.mkdirSync(workspace,{recursive:true});
  fs.writeFileSync(path.join(workspace,'workspace.json'),JSON.stringify({project_name:'Retrofit',revision:1}));
  const home='file:///C:/CompatibilizaBIM/dist/index.html?renderer=react';
  let current=home,created=0,stopped=0;
  const contents=new EventEmitter();
  contents.getURL=()=>current;
  contents.setWindowOpenHandler=()=>{};
  const window=new EventEmitter();
  window.webContents=contents;
  window.loadURL=async url=>{current=url;};
  window.isDestroyed=()=>false;
  const child=new EventEmitter();
  child.stdout=new EventEmitter();
  child.stderr=new EventEmitter();
  child.stdin={write:()=>{stopped++;}};
  child.killed=false;
  child.kill=()=>{child.killed=true;};
  const startProcess=()=>{
    process.nextTick(()=>child.stdout.emit('data',Buffer.from('CBIM_STUDIO_READY {"host":"127.0.0.1","port":38001,"token":"secret-token-123"}\n')));
    return child;
  };
  try{
    const opened=await openStudioWindow({
      workspacePath:workspace,documentsDir:root,appSourceDir:path.resolve(__dirname,'../app'),
      resourcesDir:path.join(root,'no-runtime'),BrowserWindow:class{constructor(){created++;}},
      isPackaged:false,hostWindow:window,startProcess
    });
    assert.equal(created,0,'do not create a secondary window');
    assert.equal(opened.workspace,fs.realpathSync(workspace));
    assert.match(current,/^http:\/\/127\.0\.0\.1:38001\/\?token=/);
    assert.equal(contents.listenerCount('will-navigate'),1);
    await returnToMainWindow(window);
    assert.equal(current,home);
    assert.equal(contents.listenerCount('will-navigate'),0);
    assert.ok(stopped>=1,'local review server should terminate on return');
    assert.throws(()=>returnToMainWindow(window),/não há revisão/i);
    child.emit('close',0);
    assert.equal(window.isDestroyed(),false,'original window must remain available');
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
});
