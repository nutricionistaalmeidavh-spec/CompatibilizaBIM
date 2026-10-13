// Read-only projections of the canonical SQLite BIM model list and issue states.
const str=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterBimFiles(models,query=''){
 const q=str(query).trim();
 if(!q)return Array.isArray(models)?[...models]:[];
 return (Array.isArray(models)?models:[]).filter(m=>
  [m.nome,m.arquivo_nome,m.disciplina,m.id,m.revisao].some(value=>str(value).includes(q)));
}
export function summarizeBimAlerts(issues){
 const rows=Array.isArray(issues)?issues:[];
 return {total:rows.length,pending:rows.filter(x=>!['resolvido','ignorado'].includes(x.status)).length,
  resolved:rows.filter(x=>x.status==='resolvido').length};
}
