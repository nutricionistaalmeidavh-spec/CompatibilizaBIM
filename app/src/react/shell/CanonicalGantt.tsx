import React from 'react';
import Gantt from 'frappe-gantt';
import 'frappe-gantt-style';
import {scheduleToGanttTasks} from '../../../../src/bim/visualizationAdapters.js';

export type ScheduleProposal={
 kind:'dates'|'progress';activityId:string;
 startDate?:string;endDate?:string;progress?:number;
};
type Props={
 activities:any[];
 editable?:boolean;
 onSelect?:(id:string)=>void;
 onPropose?:(proposal:ScheduleProposal)=>void;
 resetKey?:number;
};
const localDate=(input:Date|string)=>{
 const value=input instanceof Date?input:new Date(input);
 if(Number.isNaN(value.getTime()))return '';
 return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
};
export function CanonicalGantt({activities,editable=false,onSelect,onPropose,resetKey=0}:Props){
 const host=React.useRef<HTMLDivElement>(null);
 const [failure,setFailure]=React.useState('');
 const [mode,setMode]=React.useState('Week');
 const tasks=React.useMemo(()=>scheduleToGanttTasks(activities),[activities]);
 const omitted=activities.length-tasks.length;
 React.useEffect(()=>{
   if(!host.current)return;
   const target=host.current;
   if(!tasks.length){target.replaceChildren();return;}
   setFailure('');
   target.replaceChildren();
   try{
     new Gantt(target,tasks,{
       view_mode:mode,
       view_mode_select:false,
       readonly:!editable,
       readonly_dates:!editable,
       readonly_progress:!editable,
       popup_on:'click',
       scroll_to:'start',
       today_button:true,
       on_click:(task:any)=>onSelect?.(String(task.id)),
       on_date_change:(task:any,start:Date,end:Date)=>{
         if(!editable||!onPropose)return;
         onSelect?.(String(task.id));
         onPropose({kind:'dates',activityId:String(task.id),startDate:localDate(start),endDate:localDate(end)});
       },
       on_progress_change:(task:any,progress:number)=>{
         if(!editable||!onPropose)return;
         onSelect?.(String(task.id));
         onPropose({kind:'progress',activityId:String(task.id),progress:Math.round(Number(progress)*10)/10});
       }
     });
   }catch(e:any){setFailure(e?.message||'Não foi possível montar o cronograma gráfico.');target.replaceChildren();}
   return()=>target.replaceChildren();
 },[tasks,mode,editable,onSelect,onPropose,resetKey]);
 return <section className="cbim-canonical-gantt" aria-label="Cronograma visual 4D">
    <header className="cbim-gantt-head"><div><h4>Linha do tempo das atividades</h4>
      <p className="studio-muted">{editable?'Arraste barras, prazos ou avanço para preparar uma alteração. O motor só salva após confirmação.':'Leitura da linha do tempo canônica. No modo web, a edição exige o aplicativo desktop.'}</p>
    </div><div className="cbim-gantt-scale" role="group" aria-label="Escala do cronograma">
      {['Day','Week','Month'].map(value=><button type="button" key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{value==='Day'?'Dia':value==='Week'?'Semana':'Mês'}</button>)}
    </div></header>
    {!activities.length&&<p role="status">Nenhuma atividade cadastrada. Importe CSV ou cadastre uma atividade para visualizar o Gantt.</p>}
    {omitted>0&&<p role="status">{omitted} atividade(s) sem datas válidas permanecem na tabela e não aparecem no gráfico.</p>}
    {!!tasks.length&&<div className="cbim-gantt-scroll"><div ref={host} className="cbim-gantt-host"/></div>}
    {failure&&<p role="alert">Gantt indisponível: {failure}. O cronograma original permanece acessível na tabela.</p>}
 </section>;
}
