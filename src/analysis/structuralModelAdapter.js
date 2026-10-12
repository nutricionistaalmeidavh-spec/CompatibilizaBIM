import { analisarPorticoPlano2D } from './frame2d.js';
import { analisarPorticoEspacial3D } from './portal3d.js';

const VALID_CASES = new Set(['permanente','variavel','acidental']);
function materialProps(material) {
  if (typeof material === 'string') {
    if (!material.trim().startsWith('{')) return {};
    try { return JSON.parse(material); } catch { throw new Error('Material estrutural JSON inválido.'); }
  }
  return material ?? {};
}
function memberLoads(modelo, elements, loadCase) {
  const byId = new Map(elements.map(element => [element.id, element]));
  const appliedLoads = [];
  const modelUnit = modelo.unidade || 'kN-m';
  if (!['kN-m','tf-m'].includes(modelUnit)) throw new Error('Unidade estrutural não suportada: '+modelUnit);
  for (const carga of modelo.cargas ?? []) {
    if (!VALID_CASES.has(carga.combinacao || 'permanente')) throw new Error('Caso de carga desconhecido: '+carga.combinacao);
    if ((carga.combinacao || 'permanente') !== loadCase) continue;
    const id = carga.elemento_id ?? carga.elementoId;
    if (!id) throw new Error('Carga estrutural sem vínculo a elemento: selecione uma barra.');
    const element = byId.get(id);
    if (!element) throw new Error('Carga estrutural referencia elemento inexistente ou não suportado: '+id);
    const tipo = String(carga.tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const kind = tipo === 'distribuida' ? 'distribuida' : (['pontual','concentrada'].includes(tipo) ? 'concentrada' : tipo);
    if (!['distribuida','concentrada','momento'].includes(kind)) throw new Error('Tipo de carga não suportado pelo solver: '+carga.tipo);
    const expected = kind === 'distribuida' ? (modelUnit==='kN-m'?'kN/m':'tf/m')
      : kind === 'concentrada' ? (modelUnit==='kN-m'?'kN':'tf')
      : (modelUnit==='kN-m'?'kN.m':'tf.m');
    if (carga.unidade !== expected) throw new Error('Carga '+(carga.id||'')+' usa unidade '+carga.unidade+'; esperada '+expected+'.');
    const value = Number(carga.valor);
    if (!Number.isFinite(value)) throw new Error('Carga estrutural possui valor não numérico.');
    const entry = {id:carga.id,kind,value,unit:expected,elementId:id,case:loadCase,position:'midpoint',direction:kind==='momento'?'global-Z':'global-Y'};
    (element.memberLoads ??= []).push(entry);
    appliedLoads.push(entry);
  }
  return appliedLoads;
}

function normalizeModel(modelo={},loadCase='permanente') {
  if (!VALID_CASES.has(loadCase)) throw new Error('Caso de carga não suportado: '+loadCase);
  const nodes = (modelo.nos ?? []).map(node => ({
    ...node, id:node.id,
    loads:loadCase==='permanente' ? (node.loads ?? {}) : {}
  }));
  const nodeRefs = new Map();
  for (const node of nodes) {
    nodeRefs.set(node.id,node.id);
    if(node.nome) {
      if(nodeRefs.has(node.nome)&&nodeRefs.get(node.nome)!==node.id) throw new Error('Nomes duplicados de nós estruturais: '+node.nome);
      nodeRefs.set(node.nome,node.id);
    }
  }
  const elements = (modelo.elementos ?? []).filter(item=>['viga','pilar','barra'].includes(item.tipo)).map(item=>{
    const material=materialProps(item.material);
    const i=item.geometria?.nodeI ?? item.geometria?.noInicial;
    const j=item.geometria?.nodeJ ?? item.geometria?.noFinal;
    if(!i || !j || !nodeRefs.has(i) || !nodeRefs.has(j)) throw new Error('Elemento '+item.id+' precisa de nós inicial/final existentes.');
    return {
      id:item.id,nodeI:nodeRefs.get(i),nodeJ:nodeRefs.get(j),
      E:Number(material.E ?? material.moduloElasticidade ?? 200000000),
      G:material.G === undefined ? undefined : Number(material.G),
      A:Number(item.secao?.A ?? item.secao?.area ?? .01),
      I:Number(item.secao?.I ?? item.secao?.inercia ?? 1e-5),
      Iy:Number(item.secao?.Iy ?? item.secao?.I ?? item.secao?.inercia ?? 1e-5),
      Iz:Number(item.secao?.Iz ?? item.secao?.I ?? item.secao?.inercia ?? 1e-5),
      J:Number(item.secao?.J ?? (2*(item.secao?.I ?? item.secao?.inercia ?? 1e-5))),
    };
  });
  const appliedLoads=memberLoads(modelo,elements,loadCase);
  return {nos:nodes,elementos:elements,appliedLoads,loadCase};
}
export function analisarModeloEstruturalPlano(modelo={}, options={}) {
  const normalized=normalizeModel(modelo,options.loadCase || 'permanente');
  return {...analisarPorticoPlano2D(normalized),appliedLoads:normalized.appliedLoads,loadCase:normalized.loadCase};
}
export function analisarModeloEstruturalEspacial(modelo={}, options={}) {
  const normalized=normalizeModel(modelo,options.loadCase || 'permanente');
  return {...analisarPorticoEspacial3D(normalized),appliedLoads:normalized.appliedLoads,loadCase:normalized.loadCase};
}
