'use strict';
// Real publicly available IFC model -> IfcOpenShell triangulation -> existing WebGL ->
// React Studio review iframe. This tests actual geometry, not a fabricated mock mesh.
// The isolated Electron IPC response is faked only because browser QA lacks Electron.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {chromium} = require('../../app/node_modules/playwright');

const artifacts = path.join(__dirname, '../../test/real-ifc-qa');
const modelPath = path.join(artifacts, 'Duplex.ifc');
const viewerPath = path.join(artifacts, 'viewer.html');
const model = fs.readFileSync(modelPath);
const viewer = fs.readFileSync(viewerPath, 'utf8');
const source = 'https://github.com/MadsHolten/BOT-Duplex-house/blob/master/Model%20files/IFC/Duplex.ifc';
const payload = viewer.match(/<script id="session-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(model.includes(Buffer.from('ISO-10303-21')), 'Downloaded file must be IFC STEP, not a Git LFS pointer or an error page');
assert.ok(payload, 'The real viewer must embed a geometric manifest');
const manifest = JSON.parse(payload[1]);
const solids = manifest.elements.filter(e => e.vertices.length >= 9 && e.triangles.length >= 3);
const triangleCount = solids.reduce((total,e) => total + e.triangles.length / 3, 0);
const bounds = manifest.bounds;
const span = bounds.maximum.map((max,i)=>max - bounds.minimum[i]);
assert.ok(model.length > 500_000, 'Expected a genuine BIM building, not a placeholder');
assert.ok(solids.length > 30, 'IfcOpenShell must extract at least 30 real solid objects');
assert.ok(triangleCount > 300, 'IfcOpenShell must triangulate the real building');
assert.ok(span[0] > 3 && span[1] > 3 && span[2] > 2, 'Real geometry must span a 3D building-sized volume');
assert.ok(new Set(solids.map(e=>e.ifc_class)).size >= 3,'Building should have several real IFC classes');
assert.ok(solids.some(e=>e.ifc_class==='IfcSpace'),'Fixture should reproduce large IFC space volumes');
assert.ok(solids.some(e=>e.ifc_class==='IfcOpeningElement'),'Fixture should reproduce openings');
assert.match(viewer,/visible:!\['IfcSpace','IfcOpeningElement'\]\.includes\(e\.ifc_class\)/,
  'Spaces and void volumes must remain available in the data but be hidden by default');
assert.match(viewer,/classColors\[o\.e\.ifc_class\]/,
  'Architectural classes need different colors instead of the old solid gray silhouette');

const report = {
  source, filename:'Duplex.ifc', sha256:crypto.createHash('sha256').update(model).digest('hex'),
  model_bytes:model.length, schema: model.includes(Buffer.from('IFC2X3'))?'IFC2X3':'unknown',
  geometry_source:'IfcOpenShell (real file; no mocked meshes)', mesh_elements:solids.length,
  triangles:triangleCount, bounding_box_m:span, classes:[...new Set(solids.map(e=>e.ifc_class))].sort(),
  studio_ipc:'simulated because this job is browser-only', screenshots:[]
};

(async()=>{
  const browser = await chromium.launch({headless:true,args:[
    '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
    '--enable-webgl','--enable-unsafe-swiftshader'
  ]});
  const page = await browser.newPage({viewport:{width:1536,height:1050},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  try {
    // Real WebGL standalone viewer (same HTML written by viewer_cli).
    await page.route('**/real-ifc-public-viewer.html',route=>route.fulfill({
      status:200, contentType:'text/html; charset=utf-8',body:viewer
    }));
    await page.goto('http://127.0.0.1:5173/real-ifc-public-viewer.html');
    await page.locator('#viewer-canvas').waitFor();
    const webgl = await page.evaluate(()=>{
      const c=document.querySelector('#viewer-canvas');
      const gl=c.getContext('webgl');
      return {ok:Boolean(gl),status:document.querySelector('#status').textContent,
        canvasWidth:c.width,canvasHeight:c.height};
    });
    assert.equal(webgl.ok,true,'Real model could not initialize the WebGL canvas');
    assert.ok(webgl.canvasWidth>100 && webgl.canvasHeight>100,'Canvas never rendered at nonzero size');
    assert.doesNotMatch(webgl.status,/não disponível|falha|erro/i,'WebGL renderer rejected the real model');
    await page.screenshot({path:path.join(artifacts,'01-duplex-real-ifc-webgl.png'),fullPage:true});
    report.screenshots.push('01-duplex-real-ifc-webgl.png');
    report.webgl=webgl;

    // React Studio with the actual IFC HTML displayed in the sandboxed iframe.
    // Only the unavailable native Electron preload is stubbed, not the 3D geometry.
    await page.addInitScript(()=>{
      Object.defineProperty(window,'studioNavigation',{configurable:true,value:{
        renderStudioIfc:async()=>({
          ready:true,viewerToken:'qa-only-read-token',sourceFile:'Duplex.ifc',
          source:'ifcopenshell_real',maxElementsPerFile:2500,guidsById:{}
        })
      }});
    });
    await page.route('**/api/studio-state',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify({
        project:{id:'duplex-public-qa',name:'Duplex · Edificação IFC pública',
          storeys:[{id:'floor',name:'Térreo'}],systems:[],
          elements:[{id:'qa-wall',type:'wall',name:'Parede - Referência',
            start:{x:0,y:0,z:0},end:{x:5,y:0,z:0},
            height:3,thickness:0.2,storey_id:'floor',review_state:'auto',confidence:.95,
            source_refs:[],properties:{}}]},
        plan:{sources:[],config:{project_name:'Duplex · Edificação IFC pública',
          organization:'QA',units:'m',coordinate_reference:'local',
          storeys:[{name:'Térreo',elevation:0,height:3}]}},
        status:{revision:1},history:[],recovery:[],annotations:[],audit:[]
      })
    }));
    await page.route('**/api/studio-ifc-viewer?*',route=>route.fulfill({
      status:200,body:viewer,contentType:'text/html; charset=utf-8',
      headers:{
        'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
        'Cache-Control':'no-store'
      }
    }));
    await page.goto('http://127.0.0.1:5173/?surface=review');
    await page.getByRole('heading',{name:'Fontes',exact:true}).waitFor({timeout:30000});
    await page.getByRole('button',{name:'Revisão',exact:true}).click();
    await page.getByRole('button',{name:'3D real IFC'}).click();
    const frame = page.frameLocator('iframe[title="Modelo IFC real do projeto"]');
    await frame.locator('#viewer-canvas').waitFor({timeout:30000});
    await page.waitForFunction(()=>{
      const iframe=document.querySelector('iframe[title="Modelo IFC real do projeto"]');
      return iframe && iframe.getBoundingClientRect().width > 100;
    });
    const rendered=await frame.locator('#viewer-canvas').evaluate(canvas=>{
      const gl=canvas.getContext('webgl');
      return {webgl:Boolean(gl),width:canvas.width,height:canvas.height,
        status:canvas.ownerDocument.querySelector('#status')?.textContent};
    });
    assert.equal(rendered.webgl,true,'3D canvas inside Studio iframe has no WebGL');
    assert.ok(rendered.width>100 && rendered.height>100,'Studio real IFC viewport has zero size');
    assert.doesNotMatch(rendered.status||'',/não disponível|falha|erro/i);
    assert.equal(await page.getByRole('button',{name:'3D real IFC'}).getAttribute('aria-pressed'),'true');
    await page.screenshot({path:path.join(artifacts,'02-duplex-inside-studio-react.png'),fullPage:true});
    report.screenshots.push('02-duplex-inside-studio-react.png');
    report.studio_viewport=rendered;

    await page.getByRole('button',{name:'Planta 2D'}).click();
    await page.getByRole('group',{name:'Planta geométrica CBIM 2D'}).waitFor();
    await page.getByRole('button',{name:'3D real IFC'}).click();
    await frame.locator('#viewer-canvas').waitFor();
    report.switching_modes='passed';
    assert.deepEqual(errors,[],'Browser runtime exceptions');
    fs.writeFileSync(path.join(artifacts,'real-ifc-qa-report.json'),JSON.stringify(report,null,2));
    console.log('REAL IFC PASS:',JSON.stringify(report));
  } finally {await browser.close();}
})().catch(e=>{console.error('REAL IFC FAIL:',e);process.exitCode=1;});
