'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {p2Request}=require('../app/electron/p2Bridge.cjs');
const source=(tag)=>Buffer.from('ISO-10303-21;\\nHEADER;\\nFILE_DESCRIPTION(('+tag+'));\\nENDSEC;').toString('base64');
const request=(tag)=>({projectId:'study-a',action:'quantities',params:{models:[{id:'model-a',name:'model.ifc',discipline:'structure',base64:source(tag)}]}});
test('P0 rejected IFC revision preserves source, measurements and derived quantities',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cbim-staged-qto-'));
 try{
   const root=path.join(dir,'Engenharia360','BIM','studies','study-a');
   fs.mkdirSync(path.join(root,'sources'),{recursive:true});
   fs.writeFileSync(path.join(root,'sources','ESTR-model-a.ifc'),Buffer.from(source('OLD'),'base64'));
   fs.writeFileSync(path.join(root,'quantities.json'),'{"approved":true}');
   await assert.rejects(p2Request(request('NEW'),{documentsDir:dir,runPython:async()=>({stdout:JSON.stringify({ok:false,error:'Revisão IFC não autorizada'})})}),/Revisão IFC/);
   assert.equal(fs.readFileSync(path.join(root,'sources','ESTR-model-a.ifc')).toString('base64'),source('OLD'));
   assert.equal(fs.readFileSync(path.join(root,'quantities.json'),'utf8'),'{"approved":true}');
   assert.equal(fs.readdirSync(path.dirname(root)).filter(x=>x.includes('staging')).length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('P0 approved quantities atomically publish IFC and derived artifacts',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cbim-staged-ok-'));
 try{
   const root=path.join(dir,'Engenharia360','BIM','studies','study-a');
   fs.mkdirSync(path.join(root,'sources'),{recursive:true});
   fs.writeFileSync(path.join(root,'sources','ESTR-model-a.ifc'),Buffer.from(source('OLD'),'base64'));
   const result=await p2Request(request('NEW'),{documentsDir:dir,runPython:async(args)=>{
     const isolated=args[2];
     assert.notEqual(isolated,root);
     fs.writeFileSync(path.join(isolated,'quantities.json'),'{"revision":"NEW"}');
     assert.equal(fs.readFileSync(path.join(root,'sources','ESTR-model-a.ifc')).toString('base64'),source('OLD'));
     return {stdout:JSON.stringify({ok:true,result:{count:1}})};
   }});
   assert.equal(result.count,1);
   assert.equal(fs.readFileSync(path.join(root,'sources','ESTR-model-a.ifc')).toString('base64'),source('NEW'));
   assert.equal(fs.readFileSync(path.join(root,'quantities.json'),'utf8'),'{"revision":"NEW"}');
   assert.equal(fs.readFileSync(path.join(root,'sources','ESTR-model-a.ifc.previous')).toString('base64'),source('OLD'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
