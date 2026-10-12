'use strict';const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const { p2Request, validateP2Request }=require('../app/electron/p2Bridge.cjs');
test('P2 IPC rejects traversal, unknown actions, oversized or spoofed IFC',()=>{
 assert.throws(()=>validateP2Request({projectId:'../secrets',action:'status',params:{}}),/identificador/);
 assert.throws(()=>validateP2Request({projectId:'study-a',action:'system',params:{}}),/operação/);
 assert.throws(()=>validateP2Request({projectId:'study-a',action:'quantities',params:{models:[{id:'a',name:'foo.exe',base64:'QUJD'}]}}),/IFC/);
});
test('P2 backend only handles isolated study under documents, invokes real module and validates JSON response',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'p2-bridge-'));
 try{
   let arg;
   const out=await p2Request({projectId:'study-1',action:'status',params:{}},{
     documentsDir:d,runPython:async(args)=>{arg=args;return {stdout:JSON.stringify({ok:true,result:{version:1}})};}
   });
   assert.equal(out.version,1);
   assert.ok(arg.includes('compatibilizabim.p2_workflow'));
   assert.ok(arg[2].startsWith(path.join(d,'Engenharia360','BIM','studies')));
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});
