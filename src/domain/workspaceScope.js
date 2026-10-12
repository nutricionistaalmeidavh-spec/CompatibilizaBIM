// Filtragem de leitura local. Não altera entidades nem substitui relações canônicas.
const dateSpan=value=>{
 if(typeof value!=='string')return null;
 const s=value.trim(), month=/^(\d{4})-(\d{2})$/.exec(s), day=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
 if(!month&&!day)return null;
 const y=Number((month||day)[1]),m=Number((month||day)[2]);
 if(m<1||m>12)return null;
 const last=new Date(Date.UTC(y,m,0)).getUTCDate();
 if(day){
  const d=Number(day[3]);if(d<1||d>last)return null;
  return {start:s,end:s};
 }
 const p=s+'-';return {start:p+'01',end:p+String(last).padStart(2,'0')};
};
export function validateWorkspacePeriod(periodo={}){
 const inicio=periodo?.inicio||null,fim=periodo?.fim||null;
 if(inicio&&!dateSpan(inicio))throw Error('Data inicial do período inválida.');
 if(fim&&!dateSpan(fim))throw Error('Data final do período inválida.');
 if(inicio&&fim&&inicio>fim)throw Error('O início do período não pode ser posterior ao fim.');
 return {inicio,fim};
}
export function filterScopedRecords(rows=[],scope={},options={}){
 const {frontField,dateField,intervalStartField,intervalEndField}=options;
 const range=validateWorkspacePeriod(scope.periodo||{});
 return rows.filter(row=>{
  if(scope.frenteId&&(!frontField||row[frontField]!==scope.frenteId))return false;
  if(!range.inicio&&!range.fim)return true;
  let span;
  if(intervalStartField||intervalEndField){
   const start=dateSpan(row[intervalStartField]),end=dateSpan(row[intervalEndField]);
   if(!start&&!end)return false;
   span={start:start?.start||end.start,end:end?.end||start.end};
  }else{
   if(!dateField)return false;
   span=dateSpan(row[dateField]);
  }
  return !!span&&(!range.inicio||span.end>=range.inicio)&&(!range.fim||span.start<=range.fim);
 });
}
// Contas não têm frente_id. Não exibir o consolidado de obra como se fosse da frente.
export function financialScopeRows(entries=[],scope={}){
 const periodOnly={periodo:scope.periodo||{}};
 const dated=filterScopedRecords(entries,periodOnly,{dateField:'vencimento'});
 if(scope.frenteId)return {rows:[],unallocated:[],frontUnavailable:true};
 if(!scope.obraId)return {rows:dated,unallocated:[],frontUnavailable:false};
 return {
  rows:dated.filter(row=>row.obra_id===scope.obraId),
  unallocated:dated.filter(row=>row.obra_id==null),
  frontUnavailable:false
 };
}
