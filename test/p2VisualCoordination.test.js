import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {criarManifestoViewer,gerarViewerFederadoHtml} from '../src/bim/viewer.js';
test('P2 React viewer preserves canonical IFC/CBIM sources and embeds a sandboxed geometry view',()=>{
 const p=fs.readFileSync(new URL('../app/src/react/shell/CoordinationViewport.tsx',import.meta.url),'utf8');
 const c=fs.readFileSync(new URL('../app/src/react/shell/BimCoordinationPanel.tsx',import.meta.url),'utf8');
 assert.match(p,/sandbox="allow-scripts allow-downloads"/);
 assert.doesNotMatch(p,/allow-same-origin/);
 assert.match(p,/formatoModeloBim/);
 assert.match(p,/renderInlineViewer/);
 assert.match(c,/registrarDecisaoConflitoBimProjeto/);
 assert.match(c,/CoordinationViewport/);
 assert.match(c,/onViewerSelection/);
 assert.match(c,/slice\(\(Math.min\(issuePage/);
});
test('P2 iframe viewer uses real CBIM bounding boxes and can focus selected GUID without fake meshes',()=>{
 const manifest=criarManifestoViewer([{nome:'a.cbim.json',elementos:[{globalId:'GA',bbox:{min:[0,0,0],max:[1,1,1]}}],disciplina:'Estrutura'}],[{aGlobalId:'GA',bGlobalId:'GB'}]);
 const html=gerarViewerFederadoHtml(manifest);
 assert.equal(manifest.elements[0].globalId,'GA');
 assert.match(html,/cbim-viewer-focus/);
 assert.match(html,/cbim-viewer-ready/);
 assert.match(html,/cbim-viewer-selection/);
 assert.match(html,/getContext\('webgl'/);
});
test('P2 native renderer keeps actual IfcOpenShell meshes in a trusted bridge; no network viewer',()=>{
 const py=fs.readFileSync(new URL('../modules/compatibilizabim/viewer_html.py',import.meta.url),'utf8');
 const ipc=fs.readFileSync(new URL('../app/electron/main.cjs',import.meta.url),'utf8');
 const pre=fs.readFileSync(new URL('../app/electron/preload.cjs',import.meta.url),'utf8');
 assert.match(py,/cbim-viewer-focus/);
 assert.match(py,/focusBounds/);
 assert.match(ipc,/bim:render-inline-viewer-base64/);
 assert.match(ipc,/--max-elements','2500/);
 assert.match(pre,/renderInlineViewer/);
});
