'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {cbimIfcGuid, resolveStudioIfcSource} = require('../app/electron/studioIfc.cjs');

const fixture = (fn) => {
  const documents = fs.mkdtempSync(path.join(os.tmpdir(), 'cbim-studio-ifc-test-'));
  const job = path.join(documents, 'Engenharia360', 'CBIM', 'jobs', 'job-123');
  const workspace = path.join(job, 'studio-workspace');
  fs.mkdirSync(workspace, {recursive: true});
  fs.writeFileSync(path.join(workspace, 'workspace.json'), '{"project_id":"project-1"}');
  try { fn({documents, job, workspace}); } finally { fs.rmSync(documents, {recursive:true, force:true}); }
};

test('IFC GUID uses the canonical CBIM bridge UUID5 mapping', () => {
  assert.equal(cbimIfcGuid('beam-1'), '1DHJRLA99JW8Ws3uqaEgd5');
  assert.equal(cbimIfcGuid('pipe-001'), '2VdMbHQ01GBPWLWWwj1_dG');
});

test('studio viewer reads only the IFC exported within its own authorized job', () => fixture(({documents, job, workspace}) => {
  fs.writeFileSync(path.join(job, 'estrutura.ifc'), 'ISO-10303-21;\nENDSEC;');
  const found = resolveStudioIfcSource(documents, workspace);
  assert.equal(found.path, path.join(job, 'estrutura.ifc'));
  assert.equal(found.name, 'estrutura.ifc');
}));

test('studio viewer rejects missing, ambiguous, and invalid IFC sources', () => fixture(({documents, job, workspace}) => {
  assert.throws(() => resolveStudioIfcSource(documents, workspace), /IFC/);
  fs.writeFileSync(path.join(job, 'a.ifc'), 'ISO-10303-21;');
  fs.writeFileSync(path.join(job, 'b.ifc'), 'ISO-10303-21;');
  assert.throws(() => resolveStudioIfcSource(documents, workspace), /mais de um IFC/);
  fs.rmSync(path.join(job, 'b.ifc'));
  fs.writeFileSync(path.join(job, 'a.ifc'), 'arquivo inválido com conteúdo sem header STEP');
  assert.throws(() => resolveStudioIfcSource(documents, workspace), /STEP/);
}));

test('studio viewer never reads IFC outside the authorized workspace or via symlinks', () => fixture(({documents, job, workspace}) => {
  const outside = path.join(documents, 'outside.ifc');
  fs.writeFileSync(outside, 'ISO-10303-21;');
  assert.throws(() => resolveStudioIfcSource(documents, documents), /Workspace/);
  if (process.platform === 'win32') return; // Windows symlinks require developer-mode privileges.
  fs.symlinkSync(outside, path.join(job, 'external.ifc'));
  assert.throws(() => resolveStudioIfcSource(documents, workspace), /IFC/);
}));

test('review offers 2D, axonometric 3D and local IFC mesh in one React surface', () => {
  const review=fs.readFileSync(path.join(__dirname,'../app/src/react/studio/SpatialReview.tsx'),'utf8');
  const main=fs.readFileSync(path.join(__dirname,'../app/electron/main.cjs'),'utf8');
  const preload=fs.readFileSync(path.join(__dirname,'../app/electron/preload.cjs'),'utf8');
  assert.match(review, /Planta 2D/);
  assert.match(review, /Axonométrica 3D/);
  assert.match(review, /3D real IFC/);
  assert.match(review, /sandbox="allow-scripts"/);
  assert.match(review, /studio-ifc-viewer/);
  assert.match(main, /cbim:render-studio-ifc/);
  assert.match(preload, /renderStudioIfc/);
  const server=fs.readFileSync(path.join(__dirname,'../integrations/cbim-2.1.0/compatibilizabim-core/src/compatibilizabim_core/desktop/server.py'),'utf8');
  assert.match(server, /route.path == '\/api\/studio-ifc-viewer'/);
  assert.match(server, /frame-src 'self'/);
  assert.match(server, /viewer=True/);
  assert.match(server, /allow_viewer/);
  assert.match(server, /compare_digest\(viewer_token, expected_viewer_token\)/);
  assert.match(main, /viewerToken: studioViewerTokenForWindow/);
});
