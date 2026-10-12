'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { convertDwg } = require('../app/electron/cbimRunner.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cbim-free-package-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const resourcesDir = path.join(root, 'resources');
  const documentsDir = path.join(root, 'documents');
  const appSourceDir = path.join(root, 'app');
  const integrated = path.join(resourcesDir, 'integrations', 'cbim-2.1.0');
  for (const directory of [
    documentsDir, appSourceDir,
    path.join(integrated, 'compatibilizabim-core', 'src'),
    path.join(integrated, 'cbim-sdk', 'python', 'src'),
    path.join(resourcesDir, 'runtime'),
    path.join(resourcesDir, 'bridges', 'acadsharp')
  ]) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(resourcesDir, 'runtime', 'cbim-runtime.exe'), 'runtime fixture');
  fs.writeFileSync(path.join(resourcesDir, 'bridges', 'acadsharp', 'CompatibilizaBIM.ACadSharpBridge.exe'), 'bridge fixture');
  const calls = [];
  const runProcess = async (program, args) => {
    calls.push(args);
    if (args[0] === 'validate-dwg') {
      const out = args[args.indexOf('--output') + 1];
      fs.writeFileSync(path.join(out, 'validation-batch.json'), JSON.stringify({
        all_passed: true,
        reports: [{ discipline: 'hydraulic', provider: 'acadsharp', import_coverage: 0.99,
          ifc_sanity_passed: true, ifc_exported: true, passed: true, review_pending_count: 0 }]
      }));
      fs.writeFileSync(path.join(out, 'hydraulic-rede.ifc'), 'ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;');
      fs.writeFileSync(path.join(out, 'hydraulic-rede.cbim.json'), '{}');
      fs.writeFileSync(path.join(out, 'hydraulic-rede.validation.json'), '{}');
    }
    if (args[0] === 'studio' && args[1] === 'prepare') {
      const workspace = args[args.indexOf('--workspace') + 1];
      fs.mkdirSync(workspace, { recursive: true });
      fs.writeFileSync(path.join(workspace, 'workspace.json'), JSON.stringify({ project_name: 'Rede', revision: 0 }));
    }
    return { code: 0, stdout: '', stderr: '' };
  };
  const options = {
    input: { name: 'rede.dwg', discipline: 'hydraulic', base64: Buffer.from('DWG test fixture').toString('base64') },
    resourcesDir, documentsDir, appSourceDir, isPackaged: true, runProcess
  };
  return { root, calls, options, resourcesDir, documentsDir };
}

function addCommercialFiles({ resourcesDir, documentsDir }) {
  const publicKey = path.join(resourcesDir, 'license', 'public.pem');
  const customer = path.join(documentsDir, 'Engenharia360', 'CBIM', 'license', 'customer.json');
  const license = path.join(documentsDir, 'Engenharia360', 'CBIM', 'license', 'license.json');
  for (const p of [publicKey, customer, license]) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'fixture only');
  }
  return { publicKey, customer, license };
}

test('F0-01: packaged free Core completes DWG → IFC and opens a workspace without commercial activation', async t => {
  const f = fixture(t);
  const progress = [];
  const result = await convertDwg({ ...f.options, licenseMode: 'free', onProgress: p => progress.push(p) });
  assert.equal(result.report.ifc_sanity_passed, true);
  assert.equal(result.needsReview, false);
  assert.ok(result.workspaceDir);
  assert.ok(fs.existsSync(path.join(result.workspaceDir, 'workspace.json')));
  assert.equal(f.calls.some(args => args.includes('verify')), false, 'free conversion must not verify a commercial license');
  assert.deepEqual(f.calls.map(args => args[0] + ':' + (args[1] || '')), ['validate-dwg:--hydraulic', 'studio:prepare']);
  assert.equal(progress.at(-1).status, 'complete');
});

test('F0-01: free is the default in a packaged app even if commercial files do not exist', async t => {
  const f = fixture(t);
  const result = await convertDwg({ ...f.options, licenseMode: undefined });
  assert.equal(result.report.ifc_exported, true);
  assert.equal(f.calls.some(args => args.includes('verify')), false);
});

test('F0-01: opting into commercial mode requires signed-license inputs before processing', async t => {
  const f = fixture(t);
  await assert.rejects(convertDwg({ ...f.options, licenseMode: 'commercial' }), /Modo comercial: importe a licença offline/i);
  assert.equal(f.calls.length, 0);
});

test('F0-01: commercial mode validates signature and cad_to_cbim feature before creating a job', async t => {
  const f = fixture(t);
  const files = addCommercialFiles(f);
  const result = await convertDwg({ ...f.options, licenseMode: 'commercial' });
  assert.equal(result.report.ifc_sanity_passed, true);
  assert.equal(f.calls[0][0], 'studio');
  assert.equal(f.calls[0][1], 'verify');
  assert.deepEqual(f.calls[0].slice(2), ['--public-key', files.publicKey, '--customer', files.customer,
    '--license', files.license, '--feature', 'cad_to_cbim']);
  assert.equal(f.calls[1][0], 'validate-dwg');
});

test('F0-01: an invalid commercial signature or missing feature fails closed before a job starts', async t => {
  const f = fixture(t);
  addCommercialFiles(f);
  const calls = [];
  const runProcess = async (program, args) => {
    calls.push(args);
    return { code: 3, stdout: JSON.stringify({ valid: false, reason: 'missing_feature:cad_to_cbim' }), stderr: '' };
  };
  await assert.rejects(convertDwg({ ...f.options, licenseMode: 'commercial', runProcess }), /Licença offline não autorizou conversão CAD/i);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'verify');
  assert.equal(fs.existsSync(path.join(f.documentsDir, 'Engenharia360', 'CBIM', 'jobs')), false);
});

test('F0-01: unsupported license mode never silently falls back to free', async t => {
  const f = fixture(t);
  await assert.rejects(convertDwg({ ...f.options, licenseMode: 'premium' }), /Modo de licença CBIM inválido/);
  assert.equal(f.calls.length, 0);
});
