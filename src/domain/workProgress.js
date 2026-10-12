// Única regra de avanço físico para carteira, modelo e encerramento.
// A ausência de pesos válidos em qualquer etapa mantém a média simples,
// sempre identificada para não parecer uma ponderação por quantidades IFC.
const check=(value,name)=>{
 const n=Number(value??0);
 if(!Number.isFinite(n)||n<0)throw Error('Valor inválido em '+name);
 return n;
};
export function calculateWorkProgress(stages=[]){
 if(!Array.isArray(stages)||!stages.length)return {value:null,method:'sem etapas'};
 const rows=stages.map(stage=>({
  progress:Math.min(100,check(stage.percentual_concluido,'avanço da etapa')),
  weight:check(stage.percentual_peso,'peso da etapa')
 }));
 const weighted=rows.every(row=>row.weight>0);
 const denominator=weighted?rows.reduce((s,row)=>s+row.weight,0):rows.length;
 const numerator=rows.reduce((s,row)=>s+row.progress*(weighted?row.weight:1),0);
 return {
  value:Math.round(numerator/denominator*100)/100,
  method:weighted?'média ponderada por peso das etapas':rows.every(row=>row.weight===0)?'média simples (pesos não definidos)':'média simples (pesos incompletos)'
 };
}
export function projectWorkProgress(works=[],stages=[]){
 const groups=new Map();
 for(const stage of stages){
  const key=stage.obra_id;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(stage);
 }
 return works.map(work=>{
  const result=calculateWorkProgress(groups.get(work.id)||[]);
  return {...work,percentual_concluido:result.value??0,progresso_metodo:result.method};
 });
}
