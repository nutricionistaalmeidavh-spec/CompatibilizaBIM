'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateP2Request}=require('../app/electron/p2Bridge.cjs');
const base={projectId:'study_1',action:'ifc_query'};
test('P3 IPC allows only bounded, read-only original IFC selectors',()=>{
 assert.equal(validateP2Request({...base,params:{file:'HID-model_1.ifc',ifc_class:'IfcPipeSegment',text:'PVC 50mm',limit:50,offset:0}}).action,'ifc_query');
 for(const params of [
  {file:'../secrets.ifc'}, {file:'a/../b.ifc'}, {file:'file.dwg'},
  {file:'HID.ifc',ifc_class:'IfcWall);import os'},
  {file:'HID.ifc',text:'x'.repeat(121)},
  {file:'HID.ifc',limit:101},
  {file:'HID.ifc',offset:-1},
  {file:'HID.ifc',offset:1.5}
 ])assert.throws(()=>validateP2Request({...base,params}),/inválid|IFC|limite|página/i);
});
