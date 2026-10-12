'use strict'; const test=require('node:test');const assert=require('node:assert/strict');
const { parseCadRequest,parseCbimBatch }=require('../app/electron/cbimRunner.cjs');
const request=(name)=>({name,discipline:'hydraulic',base64:Buffer.from('data').toString('base64')});
test('F2 import contract accepts native DXF as first-class CAD alongside DWG',()=>{
 assert.equal(parseCadRequest(request('rede.dxf')).format,'dxf');
 assert.equal(parseCadRequest(request('rede.dwg')).format,'dwg');
 assert.throws(()=>parseCadRequest(request('unsafe.ifc')),/DWG ou DXF/);
});
test('F2 the evidence provider must correspond to original CAD format',()=>{
 const report=(provider)=>({reports:[{discipline:'hydraulic',provider,ifc_sanity_passed:true,import_coverage:1}]});
 assert.equal(parseCbimBatch(report('ezdxf'),'hydraulic','dxf').provider,'ezdxf');
 assert.throws(()=>parseCbimBatch(report('fixture'),'hydraulic','dxf'),/DXF|ezdxf/);
 assert.throws(()=>parseCbimBatch(report('ezdxf'),'hydraulic','dwg'),/ACadSharp/);
});
