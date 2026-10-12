'use strict';
// QA artifact verification is independent of commercial/human homologation.
// This helper is deliberately CommonJS so Windows PowerShell CI can invoke it.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

function evaluateQaManifest(manifest){
 const errors=[];
 if(!manifest||typeof manifest!=='object')return {qaManifestValid:false,commercialReady:false,humanHomologated:false,errors:['Manifesto ausente']};
 if(manifest.manifestVersion!==1)errors.push('Versão de manifesto desconhecida');
 if(typeof manifest.scope!=='string'||!/^QA ONLY\b/.test(manifest.scope))errors.push('Manifesto não foi identificado como preview QA');
 const expected={
  windowsRuntimeHealth:'executed-by-build-script',
  realDwgIfcSmoke:'separate-windows-ci-step',
  humanCleanMachineInstall:'pending',
  commercialPilot:'pending'
 };
 for(const [key,value] of Object.entries(expected))if(manifest.checks?.[key]!==value)errors.push('Gate não canônico: '+key);
 for(const name of ['installer','runtime','acadsharp']){
  const a=manifest.artifacts?.[name];
  if(!a||!Number.isSafeInteger(a.bytes)||a.bytes<10000||typeof a.filename!=='string'||!/^[\w. -]+\.exe$/i.test(a.filename)||typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.sha256)){
   errors.push('Metadados do artefato inválidos: '+name);
  }
 }
 return {qaManifestValid:errors.length===0,commercialReady:false,humanHomologated:false,errors,
  scope:'QA_ONLY',message:'Manifesto de build automatizado, não atestado de instalação limpa, licença ou homologação.'};
}
function verifyQaArtifacts(manifest,root){
 const structural=evaluateQaManifest(manifest);
 if(!structural.qaManifestValid)return {...structural,automatedArtifactsVerified:false};
 const known={
  installer:path.join('app','dist-installers',manifest.artifacts.installer.filename),
  runtime:path.join('runtime_min','python','cbim-runtime.exe'),
  acadsharp:path.join('runtime_min','acadsharp','CompatibilizaBIM.ACadSharpBridge.exe')
 };
 const errors=[];
 for(const [key,relative] of Object.entries(known)){
  const file=path.resolve(root,relative),relativeToRoot=path.relative(path.resolve(root),file);
  if(relativeToRoot.startsWith('..')||path.isAbsolute(relativeToRoot)){errors.push('Caminho de artefato inválido: '+key);continue;}
  if(!fs.existsSync(file)){errors.push('Artefato não encontrado: '+key);continue;}
  const stat=fs.statSync(file);
  if(!stat.isFile()||stat.size!==manifest.artifacts[key].bytes){errors.push('Tamanho de artefato divergente: '+key);continue;}
  const sha256=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if(sha256!==manifest.artifacts[key].sha256)errors.push('SHA-256 divergente: '+key);
 }
 return {...structural,automatedArtifactsVerified:errors.length===0,errors,
   commercialReady:false,humanHomologated:false};
}
module.exports={evaluateQaManifest,verifyQaArtifacts};
if(require.main===module){
 const argv=process.argv.slice(2),get=(flag)=>{const i=argv.indexOf(flag);return i<0?null:argv[i+1];};
 const file=get('--manifest'),root=get('--root')||path.resolve(__dirname,'..'),out=get('--out');
 if(!file){process.stderr.write('Uso: node scripts/p3-release-check.cjs --manifest <manifest.json> --root <repo> --out <diagnostico.json>\n');process.exitCode=2;}
 else{
  try{
   const report=verifyQaArtifacts(JSON.parse(fs.readFileSync(path.resolve(file),'utf8')),path.resolve(root));
   const result={schemaVersion:1,distributionScope:'QA_ONLY',automatedArtifactsVerified:report.automatedArtifactsVerified,
    humanHomologated:false,commercialReleaseApproved:false,failedChecks:report.errors,notice:report.message,
    requiredExternalGates:['clean_windows_install','semantic_validation','cross_platform_ifc','interruption_recovery','license_offline','client_acceptance']};
   if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(path.resolve(out),JSON.stringify(result,null,2)+'\n');}
   process.stdout.write(JSON.stringify(result,null,2)+'\n');
   if(!report.automatedArtifactsVerified)process.exitCode=1;
  }catch(e){process.stderr.write('Falha de verificação de artefato QA: '+e.message+'\n');process.exitCode=1;}
 }
}
