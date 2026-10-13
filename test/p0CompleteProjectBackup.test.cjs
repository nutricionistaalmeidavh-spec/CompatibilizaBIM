'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib');
const {makeArchive,parseArchive,saveCompleteArchive,restoreCompleteArchive}=require('../app/electron/engineeringArchive.cjs');
const sqlite=()=>Buffer.concat([Buffer.from('53514c69746520666f726d6174203300','hex'),Buffer.alloc(120)]);
test('P0 complete archive preserves SQLite, IFC and originals; rejects corrupt checksum before writes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cbim-archive-'));
 try{
   const root=path.join(dir,'Engenharia360'),source=path.join(root,'BIM','studies','alpha','sources','model.ifc');
   fs.mkdirSync(path.dirname(source),{recursive:true});
   fs.writeFileSync(path.join(root,'engenharia360.sqlite'),sqlite());
   fs.writeFileSync(source,'ISO-10303-21; TEST IFC');
   const dst=path.join(dir,'project.cbim.gz');
   assert.ok(saveCompleteArchive(dir,dst).compressedBytes>0);
   assert.deepEqual(parseArchive(fs.readFileSync(dst)).files.map(x=>x.path).sort(),['BIM/studies/alpha/sources/model.ifc','engenharia360.sqlite']);
   fs.writeFileSync(source,'CHANGED');
   const restored=restoreCompleteArchive(dir,dst);
   assert.equal(fs.readFileSync(source,'utf8'),'ISO-10303-21; TEST IFC');
   assert.ok(restored.previous);
   assert.equal(fs.readFileSync(path.join(restored.previous,'BIM','studies','alpha','sources','model.ifc'),'utf8'),'CHANGED');
   const corrupted=JSON.parse(zlib.gunzipSync(fs.readFileSync(dst)));
   corrupted.files.find(x=>x.path.endsWith('.ifc')).sha256='invalid';
   const invalid=path.join(dir,'bad.cbim.gz');fs.writeFileSync(invalid,zlib.gzipSync(JSON.stringify(corrupted)));
   assert.throws(()=>restoreCompleteArchive(dir,invalid),/checksum/i);
   assert.equal(fs.readFileSync(source,'utf8'),'ISO-10303-21; TEST IFC');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('P0 complete export rejects symlinks instead of silently dropping referenced files',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cbim-archive-symlink-'));
 try{
   const root=path.join(dir,'Engenharia360');fs.mkdirSync(root);
   fs.writeFileSync(path.join(root,'engenharia360.sqlite'),sqlite());
   fs.symlinkSync(path.join(root,'engenharia360.sqlite'),path.join(root,'ref'));
   assert.throws(()=>makeArchive(dir),/Links simbólicos/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
