export const labels={auto:'Pendente',confirmed:'Confirmado',edited:'Ajustado',rejected:'Rejeitado'};export function filterElements(elements,{state='',type='',query=''}){const q=query.trim().toLowerCase();return elements.filter(e=>(!state||e.review_state===state)&&(!type||e.type===type)&&(!q||[e.id,e.type,e.name].some(v=>String(v||'').toLowerCase().includes(q))))}export function updateReviewState(project,id,state){return{...project,elements:project.elements.map(e=>e.id===id?{...e,review_state:state}:e)}}export function learnedProfile(project,plan){const grouped={};project.elements.filter(e=>['confirmed','edited'].includes(e.review_state)).forEach(e=>(e.source_refs||[]).forEach(r=>{if(!r.layer)return;const l=r.layer.toUpperCase();grouped[l]??={};grouped[l][e.type]=(grouped[l][e.type]||0)+1}));const rules=[];Object.entries(grouped).forEach(([layer,types])=>{const pairs=Object.entries(types).sort((a,b)=>b[1]-a[1]),total=pairs.reduce((a,x)=>a+x[1],0),top=pairs[0];if(top&&total>=2&&top[1]/total>=.8)rules.push({id:'learned-layer-'+layer.toLowerCase().replace(/[^a-z0-9]+/g,'-'),target:top[0],layer,match:'exact',priority:100})});return{name:'Perfil aprendido - '+project.name,version:'1.0',organization:plan.config.organization||null,rules}}export function computeReport(project,plan){const states={};project.elements.forEach(e=>states[e.review_state]=(states[e.review_state]||0)+1);const blockers=[];if(!project.elements.length)blockers.push('A conversao nao contem elementos exportaveis');if(!plan.sources.some(s=>s.enabled))blockers.push('Nenhuma fonte habilitada');if(plan.sources.filter(s=>s.enabled).some(s=>s.discipline==='unknown'))blockers.push('Confirme a disciplina das fontes');if(!String(plan.config.project_name||'').trim())blockers.push('Informe o nome do projeto');if(!plan.config.storeys.length)blockers.push('Cadastre pelo menos um pavimento');if(states.auto)blockers.push((states.auto)+' elemento(s) automatico(s) ainda requer(em) revisao');if(states.rejected)blockers.push((states.rejected)+' elemento(s) rejeitado(s) permanecem no projeto');return{total_elements:project.elements.length,review_states:states,pending_review:(states.auto||0)+(states.rejected||0),completion_rate:project.elements.length?((states.confirmed||0)+(states.edited||0))/project.elements.length:0,blockers,ready_to_export:!blockers.length}}
/** Review decisions are edits to the existing canonical CBIM objects, not a parallel store. */
export function reviseElement(project,id,changes={}) {
 const original=project.elements.find(e=>e.id===id);
 if(!original)throw new Error('Elemento CBIM não encontrado.');
 const next={...original};
 if('name' in changes)next.name=String(changes.name||'').trim()||null;
 if('storey_id' in changes){
   const storey=changes.storey_id||null;
   if(storey&&!project.storeys?.some(s=>s.id===storey))throw new Error('Pavimento não pertence ao projeto.');
   next.storey_id=storey;
 }
 if('system_id' in changes){
   if(!('system_id' in original))throw new Error('Este tipo de elemento não possui sistema associado.');
   const system=changes.system_id||null;
   if(system&&!project.systems?.some(s=>s.id===system))throw new Error('Sistema não pertence ao projeto.');
   next.system_id=system;
 }
 if('diameter' in changes){
   if(original.type!=='pipe')throw new Error('Diâmetro só pode ser editado em tubulações.');
   const diameter=Number(changes.diameter);
   if(!Number.isFinite(diameter)||diameter<=0)throw new Error('Diâmetro deve ser positivo em metros.');
   next.diameter=diameter;
 }
 if('zOffset' in changes){
   const offset=Number(changes.zOffset);
   if(!Number.isFinite(offset)||Math.abs(offset)>1000)throw new Error('Correção Z inválida.');
   const shift=p=>({...p,z:Number(p.z||0)+offset});
   if(Array.isArray(original.path))next.path=original.path.map(shift);
   else if(Array.isArray(original.boundary))next.boundary=original.boundary.map(shift);
   else if(original.start&&original.end){next.start=shift(original.start);next.end=shift(original.end);}
   else if(original.center)next.center=shift(original.center);
   else if(original.position)next.position=shift(original.position);
   else throw new Error('O elemento não possui geometria editável em Z.');
 }
 next.review_state='edited';
 return {...project,elements:project.elements.map(e=>e.id===id?next:e)};
}
