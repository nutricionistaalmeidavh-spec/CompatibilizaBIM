import { executarAnaliseBim, formatoModeloBim } from './p0Workflow.js';
import { criarModeloBim, detectarConflitosBim } from './compatibility.js';
const ALLOWED=new Set(['intersection','collision','clearance']);
const finite=(v,label)=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error(label+' deve ser um número não negativo (metros).');return n;};
export function validarConfiguracaoFederacao(config={}){
 const modo=config.modo||'intersection';
 if(!ALLOWED.has(modo))throw new Error('Modo de compatibilização não suportado.');
 const tolerancia=finite(config.tolerancia??.002,'tolerância');
 const afastamento=finite(config.afastamento??.05,'afastamento');
 if(tolerancia>1||afastamento>100)throw new Error('Tolerâncias fora do intervalo seguro em metros.');
 return {modo,tolerancia,afastamento};
}
export function reconciliarConflitos(next,previous=[]){
 const old=new Map(previous.map(x=>[x.chave,x]));
 return next.map(issue=>{
   const prior=old.get(issue.chave);
   if(prior&&prior.fingerprint===issue.fingerprint)return {...issue,status:prior.status||'aberto',responsavel:prior.responsavel||'',prazo:prior.prazo||'',motivo:prior.motivo||'',comentarios:prior.comentarios||[]};
   return {...issue,status:'aberto',responsavel:'',prazo:'',motivo:'',comentarios:[],revisaoAlterada:Boolean(prior)};
 });
}
const revision=m=>String(m.id)+'@'+String(m.arquivo_hash||m.arquivoHash||m.revisao||'sem-hash');
export async function federarModelos(modelos,config={},services={}){
 if(!Array.isArray(modelos)||modelos.length<2)throw new Error('Selecione ao menos dois modelos diferentes para federar.');
 if(new Set(modelos.map(m=>m.id)).size!==modelos.length)throw new Error('O mesmo modelo não pode participar duas vezes.');
 const mode=validarConfiguracaoFederacao(config);
 const formats=[...new Set(modelos.map(formatoModeloBim))];
 if(formats.length!==1||formats[0]==='desconhecido')throw new Error('Federação exige modelos do mesmo formato IFC ou manifesto; não misture evidências de motores.');
 const engine=formats[0]==='ifc'?'ifcopenshell_real':'manifesto_bbox';
 const pairs=[],clashes=[];
 for(let i=0;i<modelos.length;i++)for(let j=i+1;j<modelos.length;j++){
   const [a,b]=[modelos[i],modelos[j]];
   const result=await executarAnaliseBim([a,b],{
     analisarIfc:services.analisarIfc,
     analisarManifestos:services.analisarManifestos||(([x,y])=>detectarConflitosBim(criarModeloBim(x),criarModeloBim(y),{modo:mode.modo,tolerancia:mode.tolerancia,afastamento:mode.afastamento})),
     opcoes:{mode:mode.modo,tolerance:mode.tolerancia,clearance:mode.afastamento}
   });
   if(!result.status.startsWith('concluida_'))throw new Error('Motor não comprovou análise da federação.');
   const pair={modelos:[a.id,b.id],formato:result.formato,proveniencia:engine,total:result.conflitos.length};pairs.push(pair);
   for(const raw of result.conflitos){
     const key1=String(raw.aGlobalId||raw.a_global_id||raw.indice||'');
     const key2=String(raw.bGlobalId||raw.b_global_id||raw.indice||'');
     const chave=[a.id,b.id,key1,key2,mode.modo].join('|');
     const fingerprint=revision(a)+'+'+revision(b);
     clashes.push({...raw,chave,fingerprint,modelos:[a.id,b.id],origens:[a.arquivo_nome||a.nome,b.arquivo_nome||b.nome],modo:mode.modo,proveniencia:engine});
   }
 }
 return {modelos:modelos.map(m=>({id:m.id,hash:m.arquivo_hash||null,disciplina:m.disciplina,nome:m.nome})),modo:mode.modo,tolerancia:mode.tolerancia,afastamento:mode.afastamento,formato:formats[0],motor:engine,pairs,conflitos:clashes,geradoEm:new Date().toISOString()};
}
