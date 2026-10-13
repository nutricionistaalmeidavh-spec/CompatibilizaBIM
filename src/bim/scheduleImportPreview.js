// Presentation-only validation. The Python ScheduleService remains authoritative
// and is the only service allowed to save/replace a schedule.
const REQUIRED=['activity_id','name','start_date','end_date'];
function csvRows(raw){
 const rows=[];let row=[],value='',quoted=false,closed=false;
 for(let i=0;i<raw.length;i++){
  const ch=raw[i];
  if(quoted){
   if(ch==='"'&&raw[i+1]==='"'){value+='"';i++;}
   else if(ch==='"'){quoted=false;closed=true;}
   else value+=ch;
  }else if(ch==='"'){
   if(value||closed)throw Error('Aspas de CSV inválidas.');
   quoted=true;
  }else if(ch===','){row.push(value);value='';closed=false;}
  else if(ch==='\n'||ch==='\r'){
   if(ch==='\r'&&raw[i+1]==='\n')i++;
   row.push(value);if(row.some(x=>x.trim()))rows.push(row);
   row=[];value='';closed=false;
  }else{
   if(closed&&!/\s/.test(ch))throw Error('Texto após aspas fechadas no CSV.');
   value+=ch;
  }
 }
 if(quoted)throw Error('Aspas não fechadas no CSV.');
 if(value||row.length){row.push(value);if(row.some(x=>x.trim()))rows.push(row);}
 return rows;
}
const isDate=s=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T00:00:00Z');
 return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;
};
export function previewScheduleImport(input){
 const errors=[],rows=[];
 const csv=typeof input==='string'?input.replace(/^\uFEFF/,''):'';
 if(!csv.trim())return {ok:false,count:0,rows:[],errors:['CSV vazio.']};
 if(csv.length>2_000_000)return {ok:false,count:0,rows:[],errors:['CSV maior que 2 MB.']};
 let data;
 try{data=csvRows(csv);}catch(e){return {ok:false,count:0,rows:[],errors:[e.message]};}
 const header=(data.shift()||[]).map(s=>s.trim().toLowerCase());
 if(REQUIRED.some(k=>!header.includes(k))||new Set(header).size!==header.length)
  return {ok:false,count:0,rows:[],errors:['Cabeçalho inválido. Exigido: '+REQUIRED.join(', ')+'.']};
 if(data.length>10000)return {ok:false,count:0,rows:[],errors:['Limite de prévia: 10.000 atividades.']};
 const ids=new Set(),index=new Map();
 for(const [n,values] of data.entries()){
  if(values.length!==header.length){errors.push('Linha '+(n+2)+': quantidade de colunas diferente do cabeçalho.');continue;}
  const obj=Object.fromEntries(header.map((k,i)=>[k,values[i].trim()]));
  const id=obj.activity_id,name=obj.name,predecessors=(obj.predecessors||'').split(/[;,]/).map(x=>x.trim()).filter(Boolean);
  if(!id||!name)errors.push('Linha '+(n+2)+': atividade sem código ou nome.');
  if(ids.has(id))errors.push('Linha '+(n+2)+': activity_id duplicado '+id+'.');
  ids.add(id);
  if(!isDate(obj.start_date)||!isDate(obj.end_date))errors.push('Linha '+(n+2)+': data ISO inválida.');
  else if(obj.end_date<obj.start_date)errors.push('Linha '+(n+2)+': Fim anterior ao início.');
  const row={activity_id:id,name,start_date:obj.start_date,end_date:obj.end_date,predecessors};
  rows.push(row);index.set(id,row);
 }
 for(const row of rows)for(const pred of row.predecessors)if(!ids.has(pred))errors.push('Predecessora ausente: '+pred+' na atividade '+row.activity_id+'.');
 const visited=new Set(),active=new Set();
 function walk(id){
  if(active.has(id)){errors.push('Dependência cíclica detectada em '+id+'.');return;}
  if(visited.has(id))return;
  const r=index.get(id);if(!r)return;
  active.add(id);
  for(const p of r.predecessors)walk(p);
  active.delete(id);visited.add(id);
 }
 for(const row of rows)walk(row.activity_id);
 return {ok:errors.length===0&&rows.length>0,count:rows.length,rows:rows.slice(0,30),errors:[...new Set(errors)]};
}
