'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {atomicSaveSqlite,readSqliteFile,readSqliteSnapshot,restoreSqliteFile}=require('../app/electron/databaseStore.cjs');
const sqlite=(payload)=>Buffer.concat([Buffer.from('SQLite format 3\x00'),Buffer.alloc(84),Buffer.from(payload)]);
test('F0-02: atomic save preserves prior snapshot and writes SQLite bytes',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cbim-atomic-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'engenharia360.sqlite');
  atomicSaveSqlite(file,sqlite('before').toString('base64'));
  atomicSaveSqlite(file,sqlite('after').toString('base64'));
  assert.equal(readSqliteFile(file).subarray(100).toString(),'after');
  assert.equal(readSqliteSnapshot(file).subarray(100).toString(),'before');
});
test('F0-02: malformed base64 and invalid SQLite never overwrite existing file',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cbim-atomic-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'engenharia360.sqlite');atomicSaveSqlite(file,sqlite('preserved').toString('base64'));
  for(const input of ['!!!!',Buffer.from('not sqlite').toString('base64'),'','QQ==']){
    assert.throws(()=>atomicSaveSqlite(file,input),/SQLite|base64|inval/i);
    assert.equal(readSqliteFile(file).subarray(100).toString(),'preserved');
  }
});
test('F0-02: a failed restore preserves both original file and prior snapshot',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cbim-atomic-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'engenharia360.sqlite');atomicSaveSqlite(file,sqlite('original').toString('base64'));
  assert.throws(()=>restoreSqliteFile(file,sqlite('candidate').toString('base64'),{beforeReplace:()=>{throw Error('disk disconnected')}}),/disk disconnected/);
  assert.equal(readSqliteFile(file).subarray(100).toString(),'original');
  assert.equal(readSqliteSnapshot(file).subarray(100).toString(),'original');
  assert.equal(fs.readdirSync(root).some(x=>x.endsWith('.tmp')),false);
});
test('F0-02: rollback restores the prior version without losing pre-rollback original',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cbim-atomic-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'engenharia360.sqlite');
  atomicSaveSqlite(file,sqlite('v1').toString('base64'));atomicSaveSqlite(file,sqlite('v2').toString('base64'));
  restoreSqliteFile(file,readSqliteSnapshot(file).toString('base64'));
  assert.equal(readSqliteFile(file).subarray(100).toString(),'v1');
  assert.equal(readSqliteSnapshot(file).subarray(100).toString(),'v2');
});
