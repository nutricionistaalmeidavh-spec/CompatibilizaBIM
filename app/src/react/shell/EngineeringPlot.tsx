import React from 'react';

export type EngineeringPoint={x:number;y:number|null};
export function EngineeringPlot({title,points,xUnit='',yUnit='',note=''}:{
  title:string;points:EngineeringPoint[];xUnit?:string;yUnit?:string;note?:string;
}) {
  const valid=points.filter((p):p is {x:number;y:number}=>Number.isFinite(p.x)&&typeof p.y==='number'&&Number.isFinite(p.y));
  if(valid.length<2)return <p role="status">Sem dados numéricos suficientes para representar o gráfico.</p>;
  const minX=Math.min(...valid.map(p=>p.x)),maxX=Math.max(...valid.map(p=>p.x));
  const minY=Math.min(0,...valid.map(p=>p.y)),maxY=Math.max(0,...valid.map(p=>p.y));
  const spanX=maxX-minX||1,spanY=maxY-minY||1;
  const x=(value:number)=>52+(value-minX)/spanX*595;
  const y=(value:number)=>207-(value-minY)/spanY*169;
  const segments:string[]=[];let segment='';
  points.forEach(p=>{
    if(!Number.isFinite(p.x)||p.y===null||!Number.isFinite(p.y)) {
      if(segment)segments.push(segment);
      segment='';return;
    }
    segment+=(segment?' L ':'M ')+x(p.x).toFixed(2)+' '+y(p.y).toFixed(2);
  });
  if(segment)segments.push(segment);
  const format=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:4}).format(v);
  return <figure className="cbim-math-chart">
    <figcaption><strong>{title}</strong>{note&&<small>{note}</small>}</figcaption>
    <svg viewBox="0 0 700 252" role="img" aria-label={title+'. Intervalo horizontal de '+format(minX)+' a '+format(maxX)+'; valores de '+format(minY)+' a '+format(maxY)}>
      {[0,.25,.5,.75,1].map(t=><g key={t}><line x1="52" x2="647" y1={y(minY+t*spanY)} y2={y(minY+t*spanY)} stroke="#dce5ee"/><text x="44" y={y(minY+t*spanY)+4} textAnchor="end" fontSize="11" fill="#38516a">{format(minY+t*spanY)}</text></g>)}
      <line x1="52" y1={y(0)} x2="647" y2={y(0)} stroke="#8194aa" strokeWidth="1.3"/>
      {segments.map((d,index)=><path key={index} d={d} fill="none" stroke="#24558b" strokeWidth="3" strokeLinejoin="round"/>)}
      <text x="52" y="233" fontSize="12" fill="#38516a">{format(minX)} {xUnit}</text>
      <text x="647" y="233" textAnchor="end" fontSize="12" fill="#38516a">{format(maxX)} {xUnit}</text>
      <text x="647" y="18" textAnchor="end" fontSize="12" fill="#38516a">{yUnit}</text>
    </svg>
    <small>Visualização numérica local; valores dependem das hipóteses do cálculo.</small>
  </figure>;
}
