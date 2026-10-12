import test from 'node:test';import assert from 'node:assert/strict';
import { modelFormat,checkImportFile,readCbimElements,contentFingerprint } from '../app/src/react/shell/importContract.js';
test('F2 routes IFC/CBIM/DXF/DWG files explicitly and rejects unknown inputs',()=>{
 for(const [name,fmt] of [['a.dwg','dwg'],['a.dxf','dxf'],['a.ifc','ifc'],['a.cbim.json','json']])assert.equal(modelFormat(name),fmt);
 assert.equal(checkImportFile({name:'model.dxf',size:100}), 'dxf');
 assert.throws(()=>checkImportFile({name:'a.zip',size:1}),/não suportado/);
 assert.throws(()=>checkImportFile({name:'a.dwg',size:65*1024*1024}),/64 MiB/);
});
test('F2 incomplete JSON is not silently recorded as valid empty CBIM',()=>{
 assert.throws(()=>readCbimElements('{"random":1}'),/lista de elementos/);
 assert.throws(()=>readCbimElements('not json'),/não é válido/);
 assert.equal(readCbimElements('{"schema":"CBIM","schema_version":"0.2.0","elements":[{"id":"a"}]}').length,1);
});
test('F2 a change beyond first 4096 bytes changes local identity',()=>{
 const a=Buffer.alloc(5000); const b=Buffer.from(a);b[4999]=1;
 assert.notEqual(contentFingerprint(a),contentFingerprint(b));
});
