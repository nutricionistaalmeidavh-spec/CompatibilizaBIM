// Technical output representation: the native calculators remain the source of numeric truth.
const UNIT_SUFFIXES = [
  ['KNM2','kN/m²'], ['KNM','kN·m'], ['KN','kN'], ['KPA','kPa'],
  ['MPA','MPa'], ['LMin','L/min'], ['LS','L/s'], ['MMH','mm/h'],
  ['M3S','m³/s'], ['M3','m³'], ['M2','m²'], ['CM4','cm⁴'],
  ['CM3','cm³'], ['CM2','cm²'], ['CM','cm'], ['MM','mm'],
  ['MS','m/s'], ['KG','kg'], ['KW','kW'], ['Pct','%']
];
function unitOf(key) {
  for (const [suffix,unit] of UNIT_SUFFIXES) if (key.endsWith(suffix)) return unit;
  return '';
}
function humanize(key) {
  return key.replace(/([a-zà-ÿ])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/\bKNM\b/g,'kN·m').replace(/\bKN\b/g,'kN').trim();
}
export function listarResultadosTecnicos(output, limit=75) {
  const rows=[];
  const walk=(data,prefix='',depth=0)=>{
    if (rows.length>=limit || depth>4 || data==null) return;
    if (Array.isArray(data)) {
      data.slice(0,15).forEach((entry,index)=>walk(entry,prefix?prefix+'.'+index:String(index),depth+1));
      return;
    }
    if (typeof data==='object') {
      Object.entries(data).forEach(([key,entry])=>walk(entry,prefix?prefix+'.'+key:key,depth+1));
      return;
    }
    if (typeof data==='number' && !Number.isFinite(data)) return;
    if (!['string','number','boolean'].includes(typeof data)) return;
    const key=prefix.split('.').at(-1);
    rows.push({path:prefix,label:humanize(key),unit:unitOf(key),value:data});
  };
  walk(output?.resultados ?? output);
  return rows;
}
export function formatarValorTecnico(value) {
  if(typeof value==='number') return new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:8}).format(value);
  return String(value??'—');
}
export function gerarSensibilidade({definition,inputs,inputKey,resultPath}) {
  if (!definition?.fields?.some(([key])=>key===inputKey) || !resultPath || typeof definition.fn!=='function')
    throw new Error('Parâmetro de estudo ou grandeza de resultado inválidos.');
  const base=Number(inputs[inputKey]);
  if (!Number.isFinite(base)||base<=0) throw new Error('Parâmetro deve ser positivo e finito.');
  const resultAt=(input)=>resultPath.split('.').reduce((acc,key)=>acc?.[key],definition.fn(input));
  const points=[0.8,0.9,1,1.1,1.2].map(factor=>{
    const x=base*factor;
    const y=resultAt({...inputs,[inputKey]:x});
    return {x,y:typeof y==='number'&&Number.isFinite(y)?y:null};
  });
  if(!points.some(point=>point.y!==null)) throw new Error('Grandeza numérica indisponível para o estudo.');
  return {inputKey,resultPath,points};
}
