const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { resolveCbimWorkspace, listCbimWorkspaces, parseStudioReady } = require('../app/electron/studioWindow.cjs');

test('resolve workspace from data directory and rejects path traversal', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-workspace-'));
  try {
    const jobs = path.join(root, 'Engenharia360', 'CBIM', 'jobs');
    const workspace = path.join(jobs, 'job-demo', 'studio-workspace');
    fs.mkdirSync(workspace, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'workspace.json'), JSON.stringify({ project_name: 'Predio A', revision: 3 }));
    assert.equal(resolveCbimWorkspace(root, workspace), fs.realpathSync(workspace));
    assert.throws(() => resolveCbimWorkspace(root, root), /fora do diretório autorizado/i);
    assert.throws(() => resolveCbimWorkspace(root, path.join(root,'Engenharia360','CBIM','other')), /fora do diretório autorizado|não encontrada/i);
    const list = listCbimWorkspaces(root);
    assert.equal(list.length, 1);
    assert.equal(list[0].project_name, 'Predio A');
    assert.equal(list[0].revision, 3);
    assert.equal(list[0].path, fs.realpathSync(workspace));
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('Studio cannot be directed to a remote host via startup message', () => {
  assert.throws(() => parseStudioReady('CBIM_STUDIO_READY {"host":"0.0.0.0","port":8765,"token":"abc"}'), /loopback/i);
  assert.throws(() => parseStudioReady('CBIM_STUDIO_READY {"host":"127.0.0.1","port":0,"token":"abc"}'), /porta/i);
  const result = parseStudioReady('CBIM_STUDIO_READY {"host":"127.0.0.1","port":38001,"token":"abcxyz123"}');
  assert.equal(result.host, '127.0.0.1');
  assert.equal(result.port, 38001);
  assert.equal(result.token, 'abcxyz123');
});

test('refuses non-existent workspace and symlink escape', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-symlink-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-outside-'));
  try {
    const jobs = path.join(root, 'Engenharia360', 'CBIM', 'jobs');
    const link = path.join(jobs,'job-link','studio-workspace');
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.writeFileSync(path.join(outside,'workspace.json'), '{}');
    fs.symlinkSync(outside, link, 'dir');
    assert.throws(() => resolveCbimWorkspace(root, link), /fora do diretório autorizado/i);
    assert.deepEqual(listCbimWorkspaces(root), []);
  } finally { fs.rmSync(root,{recursive:true,force:true}); fs.rmSync(outside,{recursive:true,force:true}); }
});
