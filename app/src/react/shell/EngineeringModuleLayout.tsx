import React from 'react';

export type ModuleMetric={
 label:string;value:string|number;source:string;
 tone?:'blue'|'green'|'amber'|'purple';
};
export function ModuleHero({area,title,description,meta,children}:{area:string;title:string;description:string;meta?:string;children?:React.ReactNode}){
 return <header className="cbim-p5-hero">
   <div className="cbim-p5-hero-main"><span className="cbim-p5-eyebrow">{area}</span>
     <h1>{title}</h1><p>{description}</p></div>
   {(meta||children)&&<div className="cbim-p5-hero-aside">{meta&&<span className="cbim-p5-hero-meta">{meta}</span>}{children}</div>}
 </header>;
}
export function ModuleKpis({items}:{items:ModuleMetric[]}){
 return <div className="cbim-p5-kpis" aria-label="Indicadores canônicos do módulo">{items.map((item,i)=>
   <article key={item.label} className={'cbim-p5-kpi tone-'+(item.tone||['blue','green','purple','amber'][i%4])}>
     <span>{item.label}</span><strong>{item.value}</strong><small>{item.source}</small>
   </article>)}</div>;
}
export function ModuleSearch({label,value,onChange,placeholder}:{label:string;value:string;onChange:(next:string)=>void;placeholder?:string}){
 return <label className="cbim-p5-search"><span>{label}</span>
   <input type="search" aria-label={label} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>;
}
