import React from 'react';
import {EmptyState} from '../components/ui';
type FieldType={key:string;label:string;inputType?:'number'|'text'|'checkbox';placeholder?:string;required?:boolean};
const definitions:Record<string,{title:string;hint:string;add:string;fields:FieldType[]}> = {
 equipes:{title:'Equipe presente',hint:'Identifique cada função e a quantidade de profissionais.',add:'Adicionar equipe',fields:[
  {key:'funcao',label:'Função',required:true,placeholder:'Encanador'},{key:'quantidade',label:'Quantidade da equipe',inputType:'number',required:true}]},
 servicos:{title:'Serviços executados',hint:'Registre o que foi executado. Os serviços não são copiados automaticamente de outro dia.',add:'Adicionar serviço',fields:[
  {key:'descricao',label:'Descrição do serviço',required:true,placeholder:'Serviço, local e etapa executada'}]},
 materiais:{title:'Materiais recebidos',hint:'Informe o recebido em campo; isto não gera estoque ou despesa automaticamente.',add:'Adicionar material recebido',fields:[
  {key:'material',label:'Material',required:true},{key:'quantidade',label:'Quantidade do material',inputType:'number',required:true},{key:'unidade',label:'Unidade',required:true,placeholder:'un, m, kg'}]},
 ocorrencias:{title:'Ocorrências',hint:'Use um registro para cada ocorrência.',add:'Adicionar ocorrência',fields:[
  {key:'descricao',label:'Descrição da ocorrência',required:true}]},
 impedimentos:{title:'Impedimentos',hint:'Marque como resolvido apenas quando confirmado em campo.',add:'Adicionar impedimento',fields:[
  {key:'descricao',label:'Descrição do impedimento',required:true},{key:'resolvido',label:'Resolvido',inputType:'checkbox'}]}
};
const template=(kind:string)=>Object.fromEntries(definitions[kind].fields.map(f=>[f.key,f.inputType==='checkbox'?false:'']));
type Props={kind:string;values:any[];onChange:(next:any[])=>void};
export function RdoFieldRows({kind,values,onChange}:Props){
 const schema=definitions[kind];
 const update=(index:number,key:string,value:string|boolean)=>onChange(values.map((row,i)=>i===index?{...row,[key]:value}:row));
 return <fieldset className="cbim-form-repeat" data-rdo-kind={kind}>
  <legend>{schema.title}</legend><p className="studio-muted">{schema.hint}</p>
  {values.map((row,index)=><div className="cbim-form-repeat-row" key={index}>
   <div className="cbim-form-repeat-head"><strong>{schema.title} {index+1}</strong><button type="button" aria-label={'Remover '+schema.title+' '+(index+1)} onClick={()=>onChange(values.filter((_,i)=>i!==index))}>Remover</button></div>
   <div className="cbim-react-form-grid">
    {schema.fields.map(field=><label key={field.key}>{field.label}
      {field.inputType==='checkbox'?
       <input type="checkbox" checked={!!row[field.key]} onChange={e=>update(index,field.key,e.target.checked)}/>:
       field.key==='descricao'?
        <textarea aria-label={field.label} rows={2} required={field.required} value={row[field.key]??''} placeholder={field.placeholder} onChange={e=>update(index,field.key,e.target.value)}/>:
        <input aria-label={field.label} type={field.inputType||'text'} min={field.inputType==='number'?0:undefined} step={field.inputType==='number'?'any':undefined} required={field.required} value={row[field.key]??''} placeholder={field.placeholder} onChange={e=>update(index,field.key,e.target.value)}/>}
    </label>)}
   </div>
  </div>)}
  {!values.length&&<EmptyState title="Nenhum item informado" description={kind==='servicos'?'Adicione pelo menos um serviço para salvar o RDO.':'Você pode deixar esta seção vazia.'}/>}
  <button className="cbim-add-row" type="button" onClick={()=>onChange([...values,template(kind)])}>{schema.add}</button>
 </fieldset>;
}
