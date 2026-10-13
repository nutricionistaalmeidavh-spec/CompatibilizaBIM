// Immutable engineering provenance for a BIM study. Does not alter models, IFC files or clash decisions.
const name=(v)=>String(v??'').trim();
const checksum=(data)=>{
  const raw=JSON.stringify(data);
  let hash=2166136261;
  for(let i=0;i<raw.length;i++)hash=Math.imul(hash^raw.charCodeAt(i),16777619);
  return (hash>>>0).toString(16);
};
export function opcoesElementosBim(project, modeloId, analiseId='') {
  const model=(project?.modelos||[]).find(m=>m.id===modeloId);
  if(!model)return [];
  const options=new Map();
  for(const element of model.elementos||[]) {
    for(const ref of [element.globalId,element.GlobalId,element.guid,element.id]) {
      if(typeof ref==='string'&&ref.trim()) options.set(ref,{ref,label:element.nome||element.name||ref,origem:'modelo'});
    }
  }
  const analyses=analiseId?(project.analises||[]).filter(a=>a.id===analiseId):[];
  for(const analysis of analyses)for(const conflict of analysis.conflitos||[]) {
    const pair=conflict.modelos||[];
    const ref=pair[0]===modeloId?conflict.aGlobalId:pair[1]===modeloId?conflict.bGlobalId:null;
    if(typeof ref==='string'&&ref.trim()&&!options.has(ref)) options.set(ref,{ref,label:ref,origem:'conflito'});
  }
  return [...options.values()];
}
export function prepararVinculoBim({project,modeloId,analiseId='',conflitoChave='',elementoRef='',obraId=null}={}) {
  if(!project?.id)throw Error('Selecione um estudo BIM existente.');
  if(project.obra_id&&obraId&&project.obra_id!==obraId)throw Error('Estudo BIM vinculado a outra obra; altere o contexto.');
  const model=(project.modelos||[]).find(m=>m.id===modeloId);
  if(!model)throw Error('Modelo BIM inexistente neste estudo.');
  if(conflitoChave&&!analiseId)throw Error('Vínculo a conflito exige uma análise.');
  const analysis=analiseId?(project.analises||[]).find(a=>a.id===analiseId):null;
  if(analiseId&&!analysis)throw Error('Análise não pertence ao estudo BIM.');
  if(analysis){
    const ids=[analysis.modelo_a_id,analysis.modelo_b_id,...(()=>{try{return JSON.parse(analysis.modelos_json||'[]');}catch{return []}})()].filter(v=>typeof v==='string');
    if(!ids.includes(model.id))throw Error('Modelo não participou da análise selecionada.');
  }
  const conflict=conflitoChave?(analysis?.conflitos||[]).find(c=>c.chave===conflitoChave):null;
  if(conflitoChave&&!conflict)throw Error('Conflito não encontrado na análise indicada.');
  if(conflict&&!(conflict.modelos||[]).includes(model.id))throw Error('Conflito não referencia o modelo selecionado.');
  if(elementoRef&&!opcoesElementosBim(project,modeloId,analiseId).some(e=>e.ref===elementoRef))
    throw Error('Elemento não comprovado pelo modelo ou por conflito desta análise.');
  if(conflict&&elementoRef){
    const index=(conflict.modelos||[]).indexOf(model.id);
    const expected=index===0?conflict.aGlobalId:index===1?conflict.bGlobalId:null;
    if(expected&&elementoRef!==expected)throw Error('Elemento não corresponde ao lado deste conflito.');
  }
  return {
    projetoId:project.id,obraId:project.obra_id||null,modeloId:model.id,
    revisao:Number(model.revisao||1),arquivoHash:name(model.arquivo_hash)||null,
    elementosAssinatura:checksum(model.elementos||[]),
    analiseId:analysis?.id||null,conflitoChave:conflict?.chave||null,
    conflitoFingerprint:conflict?.fingerprint||null,elementoRef:elementoRef||null,
    origem:conflict?.proveniencia||analysis?.proveniencia||'modelo_local',
    salvoEm:new Date().toISOString()
  };
}
export function estadoVinculoBim(snapshot,project) {
  if(!project||project.id!==snapshot?.projetoId)return {atual:false,motivo:'Estudo BIM indisponível ou diferente.'};
  const model=(project.modelos||[]).find(m=>m.id===snapshot.modeloId);
  if(!model)return {atual:false,motivo:'Modelo de origem não encontrado.'};
  if(Number(model.revisao||1)!==snapshot.revisao||name(model.arquivo_hash)!==name(snapshot.arquivoHash)||
     checksum(model.elementos||[])!==snapshot.elementosAssinatura)
    return {atual:false,motivo:'Revisão, arquivo ou geometria do modelo mudou; recalcule e registre um novo estudo.'};
  if(snapshot.analiseId){
    const analysis=(project.analises||[]).find(a=>a.id===snapshot.analiseId);
    if(!analysis)return {atual:false,motivo:'Análise de origem indisponível.'};
    if(snapshot.conflitoChave){
      const issue=(analysis.conflitos||[]).find(c=>c.chave===snapshot.conflitoChave);
      if(!issue||issue.fingerprint!==snapshot.conflitoFingerprint)
        return {atual:false,motivo:'Conflito não observado ou evidência geométrica alterada.'};
    }
  }
  return {atual:true,motivo:'Origem e revisão conferem com o snapshot registrado.'};
}
