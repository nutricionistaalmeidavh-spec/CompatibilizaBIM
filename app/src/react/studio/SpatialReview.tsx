import React from 'react';
import { describeCoverage, extractVisualGeometry, layoutVisualGeometry } from './geometry.js';
type Props={
  elements:any[],selected:string,onSelect:(id:string)=>void
};
const colors:Record<string,string>={auto:'#eab866',confirmed:'#41c994',edited:'#8aabff',rejected:'#f5838c'};
export function SpatialReview({elements,selected,onSelect}:Props){
  const [mode,setMode]=React.useState<'plan'|'isometric'>('plan');
  const [zoom,setZoom]=React.useState(1);
  const [pan,setPan]=React.useState({x:0,y:0});
  const all=React.useMemo(()=>elements.map(extractVisualGeometry).filter(Boolean),[elements]);
  const coverage=describeCoverage(elements,all);
  const drawn=all.length>3000?all.slice(0,3000):all;
  const layout=React.useMemo(()=>layoutVisualGeometry(drawn,{mode}),[drawn,mode]);
  const selectedGeometry=all.find(e=>e?.id===selected);
  const vbW=layout.width/zoom,vbH=layout.height/zoom;
  const viewBox=[(layout.width-vbW)/2+pan.x,(layout.height-vbH)/2+pan.y,vbW,vbH].join(' ');
  return <div className="review-geometry">
    <div className="review-geometry-toolbar" aria-label="Ferramentas do desenho">
      <div role="group" aria-label="Projeção">
        <button type="button" aria-pressed={mode==='plan'} onClick={()=>{setMode('plan');setZoom(1);setPan({x:0,y:0});}}>Planta 2D</button>
        <button type="button" aria-pressed={mode==='isometric'} onClick={()=>{setMode('isometric');setZoom(1);setPan({x:0,y:0});}}>Axonométrica 3D</button>
      </div>
      <div role="group" aria-label="Zoom">
        <button type="button" onClick={()=>setZoom(z=>Math.max(1,z/1.5))} disabled={zoom<=1} aria-label="Reduzir zoom">−</button>
        <button type="button" onClick={()=>{setZoom(1);setPan({x:0,y:0});}} aria-label="Enquadrar desenho">Enquadrar</button>
        <button type="button" onClick={()=>setZoom(z=>Math.min(12,z*1.5))} disabled={zoom>=12} aria-label="Ampliar zoom">+</button>
      </div>
    </div>
    <div className="review-geometry-surface">
      {drawn.length? <svg role="img" aria-label={mode==='plan'?'Planta geométrica CBIM 2D':'Projeção axonométrica da geometria CBIM'} viewBox={viewBox} width="100%" height="100%">
        <defs><pattern id="cbim-cad-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 38 0 L 0 0 0 38" fill="none" stroke="#2b3848" strokeWidth=".8"/></pattern></defs>
        <rect x="-99999" y="-99999" width="199998" height="199998" fill="#101820"/>
        <rect width={layout.width} height={layout.height} fill="url(#cbim-cad-grid)"/>
        {layout.items.map(shape=>{
          const d=shape.points.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ')+(shape.kind==='polygon'?' Z':'');
          return <path key={shape.id} d={d} stroke={selected===shape.id?'#ffffff':colors[shape.review_state]||'#8ba4b9'} strokeWidth={selected===shape.id?4:2} fill={shape.kind==='polygon'?'rgba(110,169,192,.13)':'none'} vectorEffect="non-scaling-stroke"
            role="button" tabIndex={0} aria-label={'Selecionar '+shape.type+' '+shape.id} aria-pressed={selected===shape.id}
            onClick={()=>onSelect(shape.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(shape.id);}}}>
            <title>{shape.type} · {shape.id} · {shape.review_state}</title>
          </path>;
        })}
      </svg>: <div className="review-geometry-empty">Nenhuma geometria CBIM com coordenadas válidas. Consulte a lista e o diagnóstico de importação.</div>}
    </div>
    <div className="review-geometry-footer">
      <span>{coverage.drawable.toLocaleString('pt-BR')} de {coverage.total.toLocaleString('pt-BR')} elementos com geometria · {mode==='plan'?'planta XY':'projeção XYZ'}</span>
      {selectedGeometry&&<span>Selecionado: {selectedGeometry.id}</span>}
      {coverage.missing>0&&<span role="status">{coverage.missing} elemento(s) sem representação geométrica; permanecem acessíveis na lista.</span>}
      {all.length>drawn.length&&<span role="status">Vista limitada a 3.000 objetos por desempenho. Refine o filtro para visualizar os demais.</span>}
    </div>
    <p className="review-geometry-note">Representação espacial baseada nas coordenadas CBIM, sem malha BREP/IFC. Para conferir sólidos exatos, abra o IFC no visualizador geométrico.</p>
  </div>;
}
