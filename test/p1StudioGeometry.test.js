import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVisualGeometry, layoutVisualGeometry, describeCoverage } from '../app/src/react/studio/geometry.js';
const a={id:'pipe-1',type:'pipe',path:[{x:0,y:0,z:0},{x:4,y:2,z:3}],diameter:.1};
test('F3 native CBIM pipe is a real spatial path, not an arbitrary element button',()=>{
 const g=extractVisualGeometry(a);assert.equal(g.id,'pipe-1');
 assert.deepEqual(g.points,[{x:0,y:0,z:0},{x:4,y:2,z:3}]);
 assert.equal(g.kind,'polyline');
 const top=layoutVisualGeometry([g],{mode:'plan'});
 const spatial=layoutVisualGeometry([g],{mode:'isometric'});
 assert.equal(top.items.length,1);assert.equal(spatial.items.length,1);
 assert.notDeepEqual(top.items[0].points,spatial.items[0].points);
});
test('F3 column and wall keep 3D elevation and source identity',()=>{
 const column=extractVisualGeometry({id:'c1',type:'column',center:{x:10,y:6,z:2},width:0.4,depth:0.3,height:3});
 const wall=extractVisualGeometry({id:'w1',type:'wall',start:{x:0,y:0,z:0},end:{x:4,y:0,z:0},thickness:0.1,height:3});
 assert.equal(column.points.length>=4,true);
 assert.ok(wall.points.some(p=>p.z===3));
 assert.equal(column.id,'c1');assert.equal(wall.id,'w1');
});
test('F3 reports invisible unsupported geometry instead of fake coordinates',()=>{
 const nodes=[{id:'x',type:'unmodelled'},{id:'pipe',type:'pipe',path:[{x:1,y:1,z:0},{x:2,y:2,z:0}],diameter:1}];
 const g=nodes.map(extractVisualGeometry);
 assert.equal(g[0],null);
 assert.deepEqual(describeCoverage(nodes,g.filter(Boolean)),{total:2,drawable:1,missing:1});
 assert.equal(layoutVisualGeometry(g.filter(Boolean),{mode:'plan'}).items.length,1);
});
test('F3 invalid coordinates are rejected without breaking remaining model geometry',()=>{
 assert.equal(extractVisualGeometry({id:'bad',type:'pipe',path:[{x:Infinity,y:0,z:0},{x:1,y:0,z:0}],diameter:1}),null);
 assert.ok(extractVisualGeometry({id:'ok',type:'fitting',position:{x:0,y:0,z:0},fitting_type:'elbow'}));
});
