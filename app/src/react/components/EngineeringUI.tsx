import React from 'react';
import {validateStudioFields} from '../../../../src/ui/studioPresentation.js';
import './engineering-ui.css';

export type FieldSpec={
  name:string;label:string;type?:'text'|'number'|'date'|'month'|'textarea'|'select'|'email';
  required?:boolean;help?:string;placeholder?:string;min?:number;max?:number;step?:number|string;
  maxLength?:number;defaultValue?:string|number;options?:Array<{value:string;label:string}>
};

export function EngineeringField({label,help,error,required,children}:{
  label:string;help?:string;error?:string;required?:boolean;children:React.ReactNode
}){
  const helpId=React.useId();
  return <label className="cbim-field">
    <span className="cbim-field-label">{label}{required&&<span aria-hidden="true" className="cbim-field-required"> *</span>}</span>
    {children}
    {error?<small id={helpId} role="alert" className="cbim-field-error">{error}</small>
      :help?<small id={helpId} className="cbim-field-help">{help}</small>:null}
  </label>;
}

export function SchemaFields({fields}:{fields:readonly FieldSpec[]}){
  validateStudioFields(fields);
  return <div className="cbim-schema-fields">{fields.map(field=>{
    const {name,label,type='text',required=false,help,placeholder,maxLength,defaultValue,min,max,step,options}=field;
    return <EngineeringField key={name} label={label} required={required} help={help}>
      {type==='textarea'
        ?<textarea name={name} required={required} placeholder={placeholder} maxLength={maxLength} defaultValue={defaultValue}/>
        :type==='select'
        ?<select name={name} required={required} defaultValue={defaultValue||''}>
          <option value="" disabled={required}>Selecione</option>
          {(options||[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        :<input name={name} type={type} required={required} placeholder={placeholder}
          maxLength={maxLength} min={min} max={max} step={step} defaultValue={defaultValue}/>}
    </EngineeringField>;
  })}</div>;
}

type Column<T>={key:string;header:string;cell:(row:T)=>React.ReactNode;align?:'left'|'right'};
export function EngineeringTable<T>({label,rows,columns,empty='Nenhum registro disponível.',rowKey}:{
  label:string;rows:readonly T[];columns:readonly Column<T>[];empty?:string;rowKey:(row:T)=>string
}){
  return <div className="cbim-table-scroll" role="region" aria-label={label} tabIndex={0}>
    <table className="cbim-data-table"><caption className="cbim-sr-only">{label}</caption>
      <thead><tr>{columns.map(c=><th key={c.key} scope="col" className={c.align==='right'?'cbim-align-right':''}>{c.header}</th>)}</tr></thead>
      <tbody>{rows.length?rows.map(row=><tr key={rowKey(row)}>
        {columns.map(c=><td key={c.key} className={c.align==='right'?'cbim-align-right':''}>{c.cell(row)}</td>)}
      </tr>):<tr><td colSpan={columns.length} className="cbim-table-empty">{empty}</td></tr>}</tbody>
    </table>
  </div>;
}

export function EngineeringBreadcrumbs({items,onNavigate}:{
  items:readonly {label:string;route?:string}[];onNavigate?:(route:string)=>void
}){
  return <nav aria-label="Caminho atual" className="cbim-breadcrumbs">
    <ol>{items.map((item,index)=><li key={index}>
      {index>0&&<span aria-hidden="true" className="cbim-breadcrumb-separator">/</span>}
      {item.route&&onNavigate?<button type="button" onClick={()=>onNavigate(item.route!)}>{item.label}</button>
        :<span aria-current={index===items.length-1?'page':undefined}>{item.label}</span>}
    </li>)}</ol>
  </nav>;
}

export function EngineeringFeedback({tone='info',title,children,busy=false}:{
  tone?:'info'|'success'|'warning'|'danger';title:string;children?:React.ReactNode;busy?:boolean
}){
  return <div className={'cbim-feedback cbim-feedback-'+tone} role={tone==='danger'?'alert':'status'} aria-busy={busy}>
    {busy&&<span className="cbim-busy-indicator" aria-hidden="true"/>}
    <div><strong>{title}</strong>{children&&<div className="cbim-feedback-details">{children}</div>}</div>
  </div>;
}

export function EngineeringConfirmDialog({open,title,description,confirmLabel='Confirmar',danger=false,typedPhrase,
  busy=false,onConfirm,onCancel}:{
  open:boolean;title:string;description:React.ReactNode;confirmLabel?:string;danger?:boolean;
  typedPhrase?:string;busy?:boolean;onConfirm:()=>void;onCancel:()=>void
}){
  const titleId=React.useId(),descriptionId=React.useId();
  const modal=React.useRef<HTMLDivElement>(null);
  const returnFocus=React.useRef<HTMLElement|null>(null);
  const [typed,setTyped]=React.useState('');
  React.useEffect(()=>{if(!open){setTyped('');return;}
    returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const first=modal.current?.querySelector<HTMLElement>('input,button');
    first?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&!busy){e.preventDefault();onCancel();}
      if(e.key!=='Tab')return;
      const focusable=[...(modal.current?.querySelectorAll<HTMLElement>('input:not([disabled]),button:not([disabled])')||[])];
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);returnFocus.current?.focus();};
  },[open,busy,onCancel]);
  if(!open)return null;
  const canProceed=!busy&&(!typedPhrase||typed===typedPhrase);
  return <div className="cbim-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onCancel();}}>
    <div className="cbim-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} ref={modal}>
      <header><h2 id={titleId}>{title}</h2></header>
      <div id={descriptionId} className="cbim-modal-description">{description}</div>
      {typedPhrase&&<EngineeringField label={'Para confirmar, digite '+typedPhrase}>
        <input autoComplete="off" value={typed} onChange={e=>setTyped(e.target.value)} aria-label={'Digite '+typedPhrase}/>
      </EngineeringField>}
      <footer>
        <button type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="button" className={danger?'cbim-button-danger':'cbim-button-primary'} disabled={!canProceed} onClick={onConfirm}>{busy?'Processando…':confirmLabel}</button>
      </footer>
    </div>
  </div>;
}
