'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const files={
  runtime:'runtime_min/python/cbim-runtime.exe',
  acadsharp:'runtime_min/acadsharp/CompatibilizaBIM.ACadSharpBridge.exe'
};
const installerDir=path.join(root,'app','dist-installers');
if(!fs.existsSync(installerDir))throw Error('Instalador NSIS ainda não foi compilado.');
const installers=fs.readdirSync(installerDir).filter(n=>/\.exe$/i.test(n));
if(installers.length!==1)throw Error('Esperado exatamente um instalador QA, encontrados: '+installers.length);
files.installer='app/dist-installers/'+installers[0];
const artifacts={};
for(const [name,relative] of Object.entries(files)) {
  const file=path.join(root,relative);
  if(!fs.statSync(file).isFile())throw Error('Artefato não é arquivo: '+relative);
  const buffer=fs.readFileSync(file);
  if(buffer.length<10000)throw Error('Artefato inválido ou pequeno demais: '+relative);
  artifacts[name]={filename:path.basename(file),bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex')};
}
const version=JSON.parse(fs.readFileSync(path.join(root,'app','package.json'),'utf8')).version;
const core=fs.readFileSync(path.join(root,'integrations/cbim-2.1.0/compatibilizabim-core/pyproject.toml'),'utf8');
const coreVersion=(core.match(/^version\s*=\s*["']([^"']+)["']/m)||[])[1]||'not-declared';
const record={
  manifestVersion:1,
  createdAt:new Date().toISOString(),
  gitCommit:process.env.GITHUB_SHA||'local',
  scope:'QA ONLY — not human homologated',
  appVersion:version,coreVersion,
  checks:{windowsRuntimeHealth:'executed-by-build-script',realDwgIfcSmoke:'separate-windows-ci-step',humanCleanMachineInstall:'pending',commercialPilot:'pending'},
  artifacts
};
const destination=path.join(root,'.p1-build','f0-smoke','release-manifest.json');
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,JSON.stringify(record,null,2)+'\n');
process.stdout.write('F0 QA SHA256 manifest: '+destination+'\n');
