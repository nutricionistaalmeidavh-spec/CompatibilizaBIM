'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const {studioLicenseArguments}=require('../app/electron/studioWindow.cjs');

test('core Studio runs without paid services or hidden license files',()=>{
  const options={isPackaged:true,resourcesDir:'/no-license-assets',documentsDir:'/no-customer-files'};
  assert.deepEqual(studioLicenseArguments({...options,mode:undefined}),[]);
  assert.deepEqual(studioLicenseArguments({...options,mode:'free'}),[]);
});
test('commercial mode is opt-in, rejects missing license, preserves offline signature inputs',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cbim-license-free-'));
  const res=path.join(tmp,'resources'),docs=path.join(tmp,'documents');
  try{
    const options={isPackaged:true,resourcesDir:res,documentsDir:docs};
    assert.throws(()=>studioLicenseArguments({...options,mode:'commercial'}),/licença offline/i);
    assert.throws(()=>studioLicenseArguments({...options,mode:'unknown'}),/Modo de licença CBIM inválido/);
    const publicKey=path.join(res,'license','public.pem');
    const customer=path.join(docs,'Engenharia360','CBIM','license','customer.json');
    const license=path.join(docs,'Engenharia360','CBIM','license','license.json');
    for(const file of [publicKey,customer,license]){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'fixture');}
    assert.deepEqual(studioLicenseArguments({...options,mode:'commercial'}),['--require-license','--public-key',publicKey,'--customer',customer,'--license',license]);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
