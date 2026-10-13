'use strict';
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const allowed=new Set(['status','quantities','quantity_records','export_quantities','pricebook','budget','budget_report','export_budget','import_schedule','activity','link','progress','simulate','measurements','measure','approve','reject','finance','bcf','ifc_query']);
function validateP2Request(request){
 if(!request||typeof request!=='object')throw Error('Requisição BIM P2 inválida');
 const {projectId,action}=request;
 if(typeof projectId!=='string'||!/^[-_a-zA-Z0-9]{1,96}$/.test(projectId))throw Error('Identificador de estudo inválido');
 if(!allowed.has(action))throw Error('Operação BIM P2 não autorizada');
 const params=request.params;
 if(!params||typeof params!=='object'||Array.isArray(params))throw Error('Parâmetros de operação inválidos');
 if(action==='ifc_query'){
   if(typeof params.file!=='string'||!/^[-A-Za-z0-9_.]{1,124}\.ifc$/i.test(params.file)||params.file.includes('..'))
     throw Error('Fonte IFC de consulta inválida');
   if(params.ifc_class!==undefined&&(typeof params.ifc_class!=='string'||!/^Ifc[A-Za-z0-9]{2,62}$/.test(params.ifc_class)))
     throw Error('Classe IFC inválida');
   if(params.text!==undefined&&(typeof params.text!=='string'||params.text.length>120))throw Error('Filtro IFC inválido');
   if(params.limit!==undefined&&(!Number.isInteger(params.limit)||params.limit<1||params.limit>100))throw Error('Limite IFC inválido');
   if(params.offset!==undefined&&(!Number.isInteger(params.offset)||params.offset<0||params.offset>5000))throw Error('Página IFC inválida');
 }
 if(action==='quantities'){
   const models=params.models;
   if(!Array.isArray(models)||!models.length||models.length>12)throw Error('Selecione entre 1 e 12 modelos IFC para quantitativos');
   const seen=new Set();
   for(const model of models){
     if(!model||!/^[-_a-zA-Z0-9]{1,96}$/.test(model.id||''))throw Error('ID do modelo IFC inválido');
     if(seen.has(model.id))throw Error('Modelo repetido em quantitativos');
     seen.add(model.id);
     if(!/\.ifc$/i.test(model.name||''))throw Error('A extração exige fontes IFC originais');
     if(typeof model.base64!=='string'||model.base64.length>90_000_000||model.base64.length<20||
       !/^[A-Za-z0-9+/]+={0,2}$/.test(model.base64))throw Error('Fonte IFC inválida ou excede 64 MiB');
   }
 }
 return {projectId,action,params};
}
async function p2Request(request,{documentsDir,runPython}){
 const {projectId,action,params}=validateP2Request(request);
 if(!documentsDir||typeof runPython!=='function')throw Error('Runtime BIM local indisponível');
 const root=path.resolve(documentsDir,'Engenharia360','BIM','studies',projectId);
 fs.mkdirSync(root,{recursive:true});
 const temp=fs.mkdtempSync(path.join(root,'.p2-request-'));
 try {
   let body={...params};
   if(action==='quantities'){
     const dest=path.join(root,'sources');fs.mkdirSync(dest,{recursive:true});
     const filenames=[];
     for(const model of params.models){
       const bytes=Buffer.from(model.base64,'base64');
       if(bytes.length>64*1024*1024||bytes.length<20||bytes.toString('base64')!==model.base64)throw Error('Conteúdo IFC excede o limite ou codificação inválida');
       if(!bytes.subarray(0,200).toString('latin1').includes('ISO-10303-21'))throw Error('Arquivo IFC sem assinatura STEP reconhecida');
       const disc=({hydraulic:'HID',architecture:'ARQ',structure:'ESTR',fire:'INC'})[model.discipline]||'MODEL';
       const filename=disc+'-'+model.id+'.ifc';
       const target=path.join(dest,filename);
       if(fs.existsSync(target)){
         const oldHash=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
         const newHash=crypto.createHash('sha256').update(bytes).digest('hex');
         if(oldHash!==newHash){const backup=target+'.previous';fs.copyFileSync(target,backup);}
       }
       const tempFile=path.join(temp,filename);fs.writeFileSync(tempFile,bytes,{flag:'wx'});
       fs.renameSync(tempFile,target);
       filenames.push(filename);
     }
     body={files:filenames,allowGeometryFallback:Boolean(params.allowGeometryFallback)};
   }
   const input=path.join(temp,'request.json');fs.writeFileSync(input,JSON.stringify(body),'utf8');
   const result=await runPython(['-m','compatibilizabim.p2_workflow',root,action,'--request',input]);
   let parsed;
   try{parsed=JSON.parse(String(result.stdout).trim());}catch{throw Error('O motor P2 não retornou contrato JSON válido');}
   if(!parsed?.ok)throw Error(parsed?.error||'O motor BIM recusou a operação');
   return parsed.result;
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
module.exports={validateP2Request,p2Request};
