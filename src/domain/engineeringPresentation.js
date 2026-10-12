// Representação técnica única, sem transformar ausência de dado em zero.
const nf=(digits)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:digits});
export function engineeringNumber(value,digits=2){
 if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return 'Não informado';
 return nf(digits).format(Number(value));
}
export function clashDistance(value){
 if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return 'Distância não informada';
 return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}).format(Number(value))+' m';
}
export function budgetBreakdown(report){
 const lines=report?.lines;
 if(!Array.isArray(lines)||!lines.length)return null;
 let base=0,withWaste=0;
 for(const line of lines){
  const fields=['quantity','base_unit_cost','waste_percent'];
  if(fields.some(key=>line[key]===undefined||line[key]===null||!Number.isFinite(Number(line[key]))))return null;
  const q=Number(line.quantity),unit=Number(line.base_unit_cost),loss=Number(line.waste_percent);
  if(q<0||unit<0||loss<0)return null;
  base+=q*unit;
  withWaste+=q*unit*(1+loss/100);
 }
 const total=Number(report.total_cost);
 if(!Number.isFinite(total)||total<0)return null;
 return {baseCost:base,wasteCost:withWaste-base,bdiCost:total-withWaste,total};
}
