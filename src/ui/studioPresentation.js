// View-only specifications. Domain commands, routes and SQLite/CBIM authority are unchanged.
export const WORK_FIELDS=Object.freeze([
  {name:'codigo',label:'Código da obra',required:true,maxLength:80},
  {name:'nome',label:'Nome da obra',required:true,maxLength:180},
  {name:'cliente',label:'Cliente',maxLength:180},
  {name:'endereco',label:'Endereço',maxLength:240},
  {name:'responsavel',label:'Responsável técnico',maxLength:180}
]);
export const FRONT_FIELDS=Object.freeze([
  {name:'nome',label:'Nome da frente',required:true,maxLength:180},
  {name:'responsavel',label:'Responsável',maxLength:180}
]);
export const SUBFRONT_FIELDS=Object.freeze([
  {name:'nome',label:'Nome da subfrente',required:true,maxLength:180},
  {name:'descricao',label:'Descrição',type:'textarea',maxLength:1000}
]);
export const CHECKLIST_FIELDS=Object.freeze([
  {name:'descricao',label:'Atividade',required:true,maxLength:250},
  {name:'responsavel',label:'Responsável',maxLength:180}
]);

export function validateStudioFields(fields) {
  if(!Array.isArray(fields))throw new TypeError('Definições de campo inválidas.');
  const keys=new Set();
  for(const field of fields){
    if(!field||typeof field.name!=='string'||!/^[a-z][a-z0-9_]*$/i.test(field.name)
      ||typeof field.label!=='string'||!field.label.trim()||keys.has(field.name))throw Error('Campo inválido ou duplicado.');
    keys.add(field.name);
    if(!['text','number','date','month','textarea','select','email'].includes(field.type||'text'))throw Error('Tipo de campo não suportado: '+field.name);
    if(field.type==='select' && (!Array.isArray(field.options)||!field.options.length))throw Error('Campo de seleção sem opções.');
  }
  return fields;
}

export function studioBreadcrumbs({route='Obras',work=null,study=null}={}) {
  // Work and study are displayed as they exist; a selected independent BIM study
  // must not be presented as a child of the currently selected work.
  if(route==='Obras')return [{label:'Obras'}];
  const trail=[{label:'Obras',route:'Obras'}];
  if(work && !(route==='BIM'&&study&&study.obra_id!==work.id))trail.push({label:String(work.nome||work.codigo||'Obra'),route:'Obras'});
  if(route==='BIM'){
    if(study){
      if(!study.obra_id)trail.push({label:'Estudo independente'});
      if(study.obra_id && (!work||study.obra_id!==work.id))trail.push({label:'Outra obra'});
      trail.push({label:'BIM',route:'BIM'});
      trail.push({label:String(study.nome||'Estudo BIM')});
    }else trail.push({label:'BIM'});
  } else trail.push({label:route});
  return trail;
}
