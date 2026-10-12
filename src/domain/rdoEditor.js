// Structured editor adapter for the existing RDO JSON contract. No schema migrations.
const text=v=>String(v??'').trim();
const isDay=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&!Number.isNaN(new Date(v+'T12:00:00Z').getTime())&&new Date(v+'T12:00:00Z').toISOString().startsWith(v);
const items=(input,key,fields)=>Array.isArray(input?.[key])?input[key].map((row,index)=>({...Object.fromEntries(fields.map(([field,format])=>[field,format==='number'?String(row[field]??''):format==='boolean'?Boolean(row[field]):text(row[field])])),__sourceIndex:index})):[];
export function createRdoDraft(date=''){
 return {data:date,turno:'Diurno',responsavel:'',clima:'',observacoes:'',equipes:[],servicos:[],materiais:[],ocorrencias:[],impedimentos:[]};
}
export function readRdoDraft(record){
 if(record?.status_aprovacao==='aprovado')throw Error('RDO aprovado é imutável; crie retificação.');
 const draft=createRdoDraft(text(record?.data));
 return {...draft,turno:text(record?.turno)||'Diurno',responsavel:text(record?.responsavel),
  clima:text(record?.clima?.condicao),observacoes:text(record?.observacoes),
  equipes:items(record,'equipes',[['funcao'],['quantidade','number']]),
  servicos:items(record,'servicosExecutados',[['descricao']]),
  materiais:items(record,'materiaisRecebidos',[['material'],['quantidade','number'],['unidade']]),
  ocorrencias:items(record,'ocorrencias',[['descricao']]),
  impedimentos:items(record,'impedimentos',[['descricao'],['resolvido','boolean']])
 };
}
export function duplicateRdoContext(record,day){
 const src=readRdoDraft({...record,status_aprovacao:'rascunho'});
 const fresh=createRdoDraft(day);
 return {...fresh,turno:src.turno,responsavel:src.responsavel,clima:src.clima,
  equipes:src.equipes.map(row=>({...row})),observacoes:''};
}
const quantity=(value,label)=>{
 const raw=text(value);const n=Number(raw);
 if(!raw||!Number.isFinite(n)||n<0)throw Error('A quantidade da '+label+' precisa ser numérica e não negativa.');
 return n;
};
const rows=(v,key)=>Array.isArray(v)?v.filter(r=>Object.values(r||{}).some(x=>x!==''&&x!==false&&x!==null&&x!==undefined)): [];
export function prepareRdoPayload(draft,original=null){
 if(!isDay(draft?.data))throw Error('Data do RDO inválida.');
 if(!text(draft?.responsavel))throw Error('Informe o responsável pelo RDO.');
 const equipes=rows(draft.equipes,'equipes').map((r,i)=>({
  ...(original?.equipes?.[r.__sourceIndex??i]||{}),funcao:text(r.funcao),quantidade:quantity(r.quantidade,'equipe')
 }));
 if(equipes.some(x=>!x.funcao))throw Error('Informe a função da equipe.');
 const servicos=rows(draft.servicos,'servicos').map((r,i)=>({...original?.servicosExecutados?.[r.__sourceIndex??i],descricao:text(r.descricao)}));
 if(!servicos.length||servicos.some(x=>!x.descricao))throw Error('Informe pelo menos um serviço executado.');
 const materiais=rows(draft.materiais,'materiais').map((r,i)=>({
  ...original?.materiaisRecebidos?.[r.__sourceIndex??i],material:text(r.material),quantidade:quantity(r.quantidade,'material'),unidade:text(r.unidade)
 }));
 if(materiais.some(x=>!x.material||!x.unidade))throw Error('Material e unidade são obrigatórios.');
 const ocorrencias=rows(draft.ocorrencias,'ocorrencias').map((r,i)=>({...original?.ocorrencias?.[r.__sourceIndex??i],descricao:text(r.descricao)}));
 const impedimentos=rows(draft.impedimentos,'impedimentos').map((r,i)=>({...original?.impedimentos?.[r.__sourceIndex??i],descricao:text(r.descricao),resolvido:!!r.resolvido}));
 if(ocorrencias.some(x=>!x.descricao)||impedimentos.some(x=>!x.descricao))throw Error('Descreva ocorrência ou impedimento.');
 return {
  data:draft.data,turno:text(draft.turno),responsavel:text(draft.responsavel),
  clima:{...original?.clima,condicao:text(draft.clima)},
  equipes,servicosExecutados:servicos,materiaisRecebidos:materiais,ocorrencias,impedimentos,
  observacoes:text(draft.observacoes),fotos:[...(original?.fotos||[])]
 };
}
