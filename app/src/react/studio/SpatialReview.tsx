import React from 'react';
import { describeCoverage, extractVisualGeometry, layoutVisualGeometry } from './geometry.js';

type Projection = 'plan' | 'isometric' | 'ifc';
type RealIfc = {
  ready: boolean; version: number; sourceFile: string; source: 'ifcopenshell_real';
  maxElementsPerFile: number; guidsById: Record<string, string>
};
type Props = {
  elements: any[]; allElementIds?: string[]; selected: string;
  onSelect: (id: string) => void
};
const colors: Record<string, string> = {
  auto:'#eab866',confirmed:'#41c994',edited:'#8aabff',rejected:'#f5838c'
};
const bridge = () => (globalThis as any).studioNavigation?.renderStudioIfc;

export function SpatialReview({elements,allElementIds=[],selected,onSelect}: Props) {
  const [mode,setMode] = React.useState<Projection>('plan');
  const [zoom,setZoom] = React.useState(1);
  const [pan,setPan] = React.useState({x:0,y:0});
  const [ifc,setIfc] = React.useState<RealIfc|null>(null);
  const [loading,setLoading] = React.useState(false);
  const [error,setError] = React.useState('');
  const [selectionInfo,setSelectionInfo] = React.useState('');
  const [frameReady,setFrameReady] = React.useState(false);
  const frame = React.useRef<HTMLIFrameElement>(null);
  const inFlight = React.useRef(false);

  const all = React.useMemo(() => elements.map(extractVisualGeometry).filter(Boolean),[elements]);
  const coverage = describeCoverage(elements, all);
  const drawn = all.length>3000?all.slice(0,3000):all;
  const layout = React.useMemo(() => layoutVisualGeometry(drawn,{mode:mode==='isometric'?'isometric':'plan'}),[drawn,mode]);
  const selectedGeometry = all.find(e=>e?.id===selected);
  const vbW=layout.width/zoom,vbH=layout.height/zoom;
  const viewBox=[(layout.width-vbW)/2+pan.x,(layout.height-vbH)/2+pan.y,vbW,vbH].join(' ');

  const focus = React.useCallback((ids: string[]) => {
    frame.current?.contentWindow?.postMessage({type:'cbim-viewer-focus',guids:ids},'*');
  },[]);
  React.useEffect(() => {
    if (mode==='ifc' && frameReady && ifc) {
      focus(selected && ifc.guidsById[selected]?[ifc.guidsById[selected]]:[]);
    }
  },[mode,frameReady,ifc,selected,focus]);

  React.useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== 'object') return;
      if (event.data.type==='cbim-viewer-ready') setFrameReady(true);
      if (event.data.type!=='cbim-viewer-selection' || !Array.isArray(event.data.guids) || !ifc) return;
      const guid = event.data.guids.find((id: unknown) => typeof id==='string' && id.length<=128);
      if (!guid) return;
      const match = Object.entries(ifc.guidsById).find(([,value])=>value===guid);
      if (match) {
        setSelectionInfo('');
        onSelect(match[0]);
      } else {
        setSelectionInfo('Elemento IFC sem vínculo canônico nesta revisão; nenhuma seleção foi alterada.');
      }
    };
    window.addEventListener('message',listener);
    return () => window.removeEventListener('message',listener);
  },[ifc,onSelect]);

  const setProjection = (next: 'plan'|'isometric') => {
    setMode(next);setZoom(1);setPan({x:0,y:0});setSelectionInfo('');setFrameReady(false);
  };
  const loadIfc = async (refresh = false) => {
    setMode('ifc');
    if (inFlight.current || (!refresh && ifc)) return;
    const render = bridge();
    if (!render) {
      setError('O 3D real IFC só está disponível na revisão aberta pelo aplicativo desktop. Use a planta 2D ou a axonométrica nesta sessão.');
      return;
    }
    inFlight.current=true;setLoading(true);setError('');setSelectionInfo('');
    try {
      const result = await render(allElementIds);
      if (!result?.ready || result.source!=='ifcopenshell_real') throw new Error('O motor local não confirmou a malha IFC.');
      setIfc({...result,version:Date.now()});setFrameReady(false);
    } catch (err: any) {
      setError(err?.message||'Falha ao carregar as malhas IFC.');
      if (refresh) setIfc(null);
    } finally {inFlight.current=false;setLoading(false);}
  };
  return <div className="review-geometry">
    <div className="review-geometry-toolbar" aria-label="Ferramentas do desenho">
      <div role="group" aria-label="Modo de visualização" className="review-projections">
        <button type="button" aria-pressed={mode==='plan'} onClick={()=>setProjection('plan')}>Planta 2D</button>
        <button type="button" aria-pressed={mode==='isometric'} onClick={()=>setProjection('isometric')}>Axonométrica 3D</button>
        <button type="button" aria-pressed={mode==='ifc'} onClick={()=>void loadIfc()} disabled={loading}>3D real IFC</button>
      </div>
      <div role="group" aria-label="Ferramentas da vista" className="review-viewport-actions">
        {mode==='ifc' ? <button type="button" disabled={!ifc||loading} onClick={()=>void loadIfc(true)}>Atualizar malhas</button> :
          <>
            <button type="button" onClick={()=>setZoom(z=>Math.max(1,z/1.5))} disabled={zoom<=1} aria-label="Reduzir zoom">−</button>
            <button type="button" onClick={()=>{setZoom(1);setPan({x:0,y:0});}} aria-label="Enquadrar desenho">Enquadrar</button>
            <button type="button" onClick={()=>setZoom(z=>Math.min(12,z*1.5))} disabled={zoom>=12} aria-label="Ampliar zoom">+</button>
          </>}
        {mode==='ifc'&&<button type="button" disabled={!ifc||loading} onClick={()=>focus([])}>Enquadrar tudo</button>}
      </div>
    </div>
    <div className="review-geometry-surface">
      {mode==='ifc' ? <>
        {ifc?.ready && !loading && <iframe ref={frame} title="Modelo IFC real do projeto" className="studio-ifc-frame"
          sandbox="allow-scripts" referrerPolicy="no-referrer" src={'/api/studio-ifc-viewer?rev='+ifc.version}
          onLoad={()=>setFrameReady(true)}/>}
        {loading&&<div className="review-geometry-empty" role="status" aria-live="polite">Extraindo malhas IFC no computador… A revisão e as correções permanecem preservadas.</div>}
        {!loading&&!ifc&&<div className="review-geometry-empty" role="status">
          <strong>Modelo IFC ainda não carregado</strong>
          <p>{error||'Carregue o IFC exportado pela conversão local para visualizar os sólidos tridimensionais.'}</p>
          <button type="button" onClick={()=>void loadIfc(true)} disabled={loading}>Tentar carregar o 3D real</button>
          <p>Enquanto isso, a planta 2D e a axonométrica continuam disponíveis.</p>
        </div>}
      </> : drawn.length ? <svg role="group" aria-label={mode==='plan'?'Planta geométrica CBIM 2D':'Projeção axonométrica da geometria CBIM'} viewBox={viewBox} width="100%" height="100%">
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
      </svg> : <div className="review-geometry-empty">Nenhuma geometria CBIM com coordenadas válidas. Consulte a lista e o diagnóstico de importação.</div>}
    </div>
    {mode==='ifc'&&error&&ifc&&<p role="alert" className="studio-ifc-error">A atualização falhou: {error}. A visualização anterior foi preservada. <button type="button" onClick={()=>void loadIfc(true)}>Tentar novamente</button></p>}
    <div className="review-geometry-footer">
      {mode==='ifc'?<>
        <span>{ifc?'3D real · '+ifc.sourceFile:'3D real · IFC local'}</span>
        <span>{ifc?'Malhas trianguladas por IfcOpenShell; até '+ifc.maxElementsPerFile.toLocaleString('pt-BR')+' elementos por arquivo.':'Nenhuma malha confirmada.'}</span>
        {selectionInfo&&<span role="status">{selectionInfo}</span>}
      </>:<>
        <span>{coverage.drawable.toLocaleString('pt-BR')} de {coverage.total.toLocaleString('pt-BR')} elementos com geometria · {mode==='plan'?'planta XY':'projeção XYZ'}</span>
        {selectedGeometry&&<span>Selecionado: {selectedGeometry.id}</span>}
        {coverage.missing>0&&<span role="status">{coverage.missing} elemento(s) sem representação geométrica; permanecem acessíveis na lista.</span>}
        {all.length>drawn.length&&<span role="status">Vista limitada a 3.000 objetos por desempenho. Refine o filtro para visualizar os demais.</span>}
      </>}
    </div>
    <p className="review-geometry-note">{mode==='ifc'
      ? 'Sólidos do IFC exportado, não projeções CBIM. A seleção só é vinculada ao inspetor quando o GUID canônico corresponde. O arquivo original não é modificado.'
      : 'Projeção baseada nas coordenadas CBIM, sem malha BREP/IFC. Use “3D real IFC” para conferir sólidos.'}</p>
  </div>;
}
