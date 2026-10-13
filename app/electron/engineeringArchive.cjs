'use strict';
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), zlib=require('node:zlib');
const MAGIC='CBIM_COMPLETE_BACKUP_V1';
const MAX_FILE=512*1024*1024, MAX_ARCHIVE=1024*1024*1024;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const rootOf=documentsDir=>path.resolve(documentsDir,'Engenharia360');
function checked(name){
 if(typeof name!=='string'||!name||name.startsWith('/')||name.includes('\\')||name.includes(String.fromCharCode(0))||path.isAbsolute(name)||name.split('/').some(v=>!v||v==='.'||v==='..'))throw Error('Caminho inseguro no backup');
 return name;
}
function filesIn(root,at=root,list=[]){
 for(const name of fs.readdirSync(at).sort()){
   const f=path.join(at,name),stat=fs.lstatSync(f);
   if(stat.isSymbolicLink())throw Error('Links simbólicos não podem integrar backup completo: '+name);
   if(stat.isDirectory())filesIn(root,f,list);
   else if(stat.isFile()){
     if(stat.size>MAX_FILE)throw Error('Arquivo acima de 512 MiB: '+name+'. Backup não criado.');
     list.push({path:checked(path.relative(root,f).split(path.sep).join('/')),bytes:fs.readFileSync(f)});
   }else throw Error('Tipo de arquivo não suportado: '+name);
 }
 return list;
}
function makeArchive(documentsDir){
 const root=rootOf(documentsDir);
 if(!fs.existsSync(path.join(root,'engenharia360.sqlite')))throw Error('Banco SQLite local não encontrado.');
 let total=0;
 const files=filesIn(root).map(({path:name,bytes})=>{
   total+=bytes.length;if(total>MAX_ARCHIVE)throw Error('Projeto acima de 1 GiB; backup não foi criado.');
   return {path:name,size:bytes.length,sha256:sha(bytes),data:bytes.toString('base64')};
 });
 return zlib.gzipSync(Buffer.from(JSON.stringify({magic:MAGIC,createdAt:new Date().toISOString(),files})));
}
function parseArchive(input){
 if(!Buffer.isBuffer(input)||input.length>MAX_ARCHIVE)throw Error('Arquivo de backup inválido ou grande demais.');
 let value;
 try{value=JSON.parse(zlib.gunzipSync(input,{maxOutputLength:Math.ceil(MAX_ARCHIVE*1.4)}).toString('utf8'));}
 catch{throw Error('Backup completo inválido ou compactação corrompida.');}
 if(value?.magic!==MAGIC||!Array.isArray(value.files)||value.files.length>200000)throw Error('Contrato do backup completo inválido.');
 let total=0;const seen=new Set(),files=[];
 for(const item of value.files){
   const name=checked(item.path);
   if(seen.has(name)||!Number.isSafeInteger(item.size)||item.size<0||item.size>MAX_FILE||typeof item.data!=='string')throw Error('Arquivo do backup inválido ou duplicado: '+name);
   seen.add(name);
   const bytes=Buffer.from(item.data,'base64');total+=bytes.length;
   if(total>MAX_ARCHIVE||bytes.length!==item.size||bytes.toString('base64')!==item.data||sha(bytes)!==item.sha256)throw Error('Checksum divergente: '+name);
   files.push({path:name,bytes});
 }
 const db=files.find(f=>f.path==='engenharia360.sqlite');
 if(!db||db.bytes.length<100||!db.bytes.subarray(0,16).equals(Buffer.from('53514c69746520666f726d6174203300','hex')))throw Error('Backup sem banco SQLite válido.');
 return {createdAt:value.createdAt||null,totalBytes:total,files};
}
function saveCompleteArchive(documentsDir,output){
 const root=rootOf(documentsDir),out=path.resolve(output);
 if(out===root||out.startsWith(root+path.sep))throw Error('Selecione destino fora da pasta Engenharia360.');
 const data=makeArchive(documentsDir),tmp=out+'.pending-'+crypto.randomBytes(6).toString('hex');
 try{fs.writeFileSync(tmp,data,{flag:'wx',mode:0o600});fs.renameSync(tmp,out);}
 finally{if(fs.existsSync(tmp))fs.rmSync(tmp,{force:true});}
 return {path:out,compressedBytes:data.length};
}
function inspectCompleteArchive(file){
 const x=parseArchive(fs.readFileSync(file));
 return {path:file,createdAt:x.createdAt,count:x.files.length,totalBytes:x.totalBytes};
}
function restoreCompleteArchive(documentsDir,file){
 const archive=parseArchive(fs.readFileSync(file)),root=rootOf(documentsDir),parent=path.dirname(root);
 fs.mkdirSync(parent,{recursive:true});
 const suffix=crypto.randomBytes(7).toString('hex'),staged=path.join(parent,'.Engenharia360-staged-'+suffix),before=path.join(parent,'Engenharia360.before-restore-'+suffix);
 let moved=false;
 try{
   fs.mkdirSync(staged,{recursive:true});
   for(const f of archive.files){
     const target=path.join(staged,...f.path.split('/'));
     fs.mkdirSync(path.dirname(target),{recursive:true});
     fs.writeFileSync(target,f.bytes,{flag:'wx',mode:0o600});
   }
   if(fs.existsSync(root)){fs.renameSync(root,before);moved=true;}
   try{fs.renameSync(staged,root);}
   catch(error){if(moved&&!fs.existsSync(root))fs.renameSync(before,root);throw error;}
   return {restored:archive.files.length,previous:moved?before:null};
 }finally{if(fs.existsSync(staged))fs.rmSync(staged,{recursive:true,force:true});}
}
module.exports={makeArchive,parseArchive,saveCompleteArchive,inspectCompleteArchive,restoreCompleteArchive};
