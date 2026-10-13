import { validarCalculoIndependente } from '../validation/independentOracle.js';
const own=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);
function readNumber(data,path) {
  if(typeof path!=='string'||path.length>120||!path.split('.').every(p=>/^[A-Za-z][A-Za-z0-9_]*$/.test(p)||/^\d{1,3}$/.test(p)))
    throw Error('Grandeza de saída inválida.');
  let current=data;
  for(const key of path.split('.')){
    if(current===null||typeof current!=='object'||!own(current,key))throw Error('Grandeza não encontrada no motor.');
    current=current[key];
  }
  if(typeof current!=='number'||!Number.isFinite(current))throw Error('Grandeza não numérica ou não finita.');
  return current;
}
function normalized(definition,inputs,adjustments={}) {
  if(!definition||typeof definition.fn!=='function'||!Array.isArray(definition.fields))throw Error('Calculadora indisponível.');
  const allowed=new Set(definition.fields.map(([key])=>key));
  for(const [key,value] of Object.entries(adjustments)){
    if(!allowed.has(key))throw Error('Ajuste usa parâmetro desconhecido: '+key);
    if(typeof value!=='number'||!Number.isFinite(value))throw Error('Ajuste deve ser número finito.');
  }
  const merged={...inputs,...adjustments};
  for(const key of allowed)if(typeof merged[key]!=='number'||!Number.isFinite(merged[key]))throw Error('Entrada não numérica: '+key);
  return merged;
}
function normalizeConstraints(definition,inputs,constraints) {
  if(!Array.isArray(constraints)||constraints.length<1||constraints.length>3)throw Error('Informe entre uma e três restrições.');
  const preview=definition.fn(normalized(definition,inputs));
  return constraints.map(c=>{
    const limit=Number(c?.limit);
    if(!Number.isFinite(limit)||!['<=','>='].includes(c?.operator))throw Error('Limite ou comparador inválido.');
    readNumber(preview,c.path);
    return {path:c.path,operator:c.operator,limit};
  });
}
function calculate(definition,calculatorId,inputs,constraints) {
  let output,verification,checks;
  try {
    output=definition.fn(inputs);
    verification=validarCalculoIndependente(calculatorId,inputs,output);
    checks=constraints.map(c=>{
      const value=readNumber(output,c.path);
      return {...c,value,atende:c.operator==='<='?value<=c.limit+1e-9:value>=c.limit-1e-9};
    });
  }catch(err){
    return {entradas:{...inputs},resultados:null,verificacao:{ok:false,errors:[String(err.message||err)]},
      avaliacao:{viavel:false,restricoes:[],motivo:'Cálculo não executável'}};
  }
  return {entradas:{...inputs},resultados:output,verificacao:verification,
    avaliacao:{viavel:verification.ok&&checks.every(c=>c.atende),restricoes:checks,
      motivo:verification.ok?'Verificação matemática parcial; norma não homologada':'Oráculo matemático rejeitou os resultados'}};
}
export function compararAlternativas({definition,calculatorId,inputs,scenarios=[],constraints}) {
  const rules=normalizeConstraints(definition,inputs,constraints);
  if(!Array.isArray(scenarios)||scenarios.length<1||scenarios.length>6)throw Error('Compare de uma a seis alternativas.');
  return scenarios.map((scenario,index)=>{
    if(!scenario||typeof scenario.nome!=='string'||!scenario.nome.trim())throw Error('Identifique cada alternativa.');
    const adjusted=normalized(definition,inputs,scenario.ajustes||{});
    return {id:'cenario_'+(index+1),nome:scenario.nome.trim().slice(0,80),
      ...calculate(definition,calculatorId,adjusted,rules)};
  });
}
export function buscarDimensionamentoInverso({definition,calculatorId,inputs,variableKey,min,max,constraints,objetivo='minimo'}) {
  if(!definition?.fields?.some(([key])=>key===variableKey))throw Error('Selecione um parâmetro canônico.');
  if(!['minimo','maximo'].includes(objetivo))throw Error('Objetivo inválido.');
  if(typeof min!=='number'||typeof max!=='number'||!Number.isFinite(min)||!Number.isFinite(max)||
    min>=max||Math.abs(max-min)>1e8)throw Error('Limites devem ser finitos, crescentes e seguros.');
  const rules=normalizeConstraints(definition,inputs,constraints);
  const count=41;
  const amostras=Array.from({length:count},(_,i)=>{
    const x=min+(max-min)*i/(count-1);
    return {x,...calculate(definition,calculatorId,normalized(definition,inputs,{[variableKey]:x}),rules)};
  });
  const valid=amostras.filter(item=>item.avaliacao.viavel);
  if(!valid.length)return {status:'nao_encontrado',candidato:null,amostras,
    metodo:'Busca limitada por amostragem em 41 pontos; ausência de solução na grade não prova inviabilidade global.'};
  const ordered=objetivo==='minimo'?amostras:[...amostras].reverse();
  let best=ordered.find(item=>item.avaliacao.viavel);
  const index=ordered.indexOf(best);
  if(index>0&&!ordered[index-1].avaliacao.viavel){
    let failed=ordered[index-1].x,feasible=best.x;
    for(let i=0;i<24;i++){
      const x=(failed+feasible)/2;
      const candidate={x,...calculate(definition,calculatorId,normalized(definition,inputs,{[variableKey]:x}),rules)};
      if(candidate.avaliacao.viavel){feasible=x;best=candidate;}else failed=x;
    }
  }
  return {status:'viavel_amostrado',candidato:best,amostras,
    metodo:'Busca por amostragem em 41 pontos com refinamento de fronteira por bisseção (até 24 passos). Solução viável encontrada; não garante ótimo global nem conformidade normativa.'};
}
