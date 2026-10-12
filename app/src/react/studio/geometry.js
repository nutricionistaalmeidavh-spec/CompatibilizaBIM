// CBIM native coordinates only. No synthetic grid positions for elements lacking geometry.
const point = p => {
  if (!p || !['x','y'].every(k => Number.isFinite(Number(p[k])))) return null;
  const z = p.z ?? 0;
  if (!Number.isFinite(Number(z))) return null;
  return {x:Number(p.x),y:Number(p.y),z:Number(z)};
};
const xyz = values => values.every(Boolean) ? values : null;
const corners = (p,w,d,h) => [
  {x:p.x-w/2,y:p.y-d/2,z:p.z},{x:p.x+w/2,y:p.y-d/2,z:p.z},
  {x:p.x+w/2,y:p.y+d/2,z:p.z},{x:p.x-w/2,y:p.y+d/2,z:p.z},
  {x:p.x-w/2,y:p.y-d/2,z:p.z},
  {x:p.x-w/2,y:p.y-d/2,z:p.z+h},{x:p.x+w/2,y:p.y-d/2,z:p.z+h},
  {x:p.x+w/2,y:p.y+d/2,z:p.z+h},{x:p.x-w/2,y:p.y+d/2,z:p.z+h}
];
function positive(value,fallback) {const n=Number(value);return Number.isFinite(n)&&n>0?n:fallback;}
export function extractVisualGeometry(element={}) {
  const base={id:String(element.id||''),type:String(element.type||'unknown'),review_state:element.review_state||'auto'};
  if(!base.id)return null;
  let points,kind='polyline';
  const start=point(element.start),end=point(element.end),center=point(element.center),position=point(element.position);
  if (start&&end) {
    const h=positive(element.height,0);
    points=h?[start,end,{...end,z:end.z+h},{...start,z:start.z+h},start]:[start,end];
  } else if(Array.isArray(element.path)&&element.path.length>=2) {
    points=xyz(element.path.map(point));
  } else if(Array.isArray(element.boundary)&&element.boundary.length>=3) {
    points=xyz(element.boundary.map(point));kind='polygon';
  } else if(center) {
    points=corners(center,positive(element.width,0.2),positive(element.depth,0.2),positive(element.height,0));
  } else if(position) {
    const w=positive(element.width||element.nominal_diameter||element.diameter,.2);
    points=corners(position,w,positive(element.depth,w),positive(element.height,0));
  } else if(element.bbox?.min&&element.bbox?.max) {
    const min=element.bbox.min.map(Number),max=element.bbox.max.map(Number);
    if(min.length!==3||max.length!==3||![...min,...max].every(Number.isFinite))return null;
    points=corners({x:(min[0]+max[0])/2,y:(min[1]+max[1])/2,z:min[2]},max[0]-min[0],max[1]-min[1],max[2]-min[2]);
  } else return null;
  if(!points||!points.length||points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))return null;
  return {...base,kind,points};
}
export function describeCoverage(elements,visuals) {
  return {total:elements.length,drawable:visuals.length,missing:Math.max(0,elements.length-visuals.length)};
}
const projectPoint=(p,mode)=>mode==='isometric'?{
  x:(p.x-p.y)*0.8660254,
  y:(p.x+p.y)*0.45-p.z*1.05
}:{x:p.x,y:-p.y};
export function layoutVisualGeometry(visuals, {mode='plan',width=900,height=560}={}) {
  if(!['plan','isometric'].includes(mode))throw new Error('Modo geométrico desconhecido');
  const projected=visuals.map(v=>({...v,points:v.points.map(p=>projectPoint(p,mode))}));
  const all=projected.flatMap(v=>v.points);
  if(!all.length)return {items:[],width,height,extent:null};
  const left=Math.min(...all.map(p=>p.x)),right=Math.max(...all.map(p=>p.x));
  const top=Math.min(...all.map(p=>p.y)),bottom=Math.max(...all.map(p=>p.y));
  const xrange=Math.max(right-left,1e-5),yrange=Math.max(bottom-top,1e-5);
  const padding=38,scale=Math.min((width-2*padding)/xrange,(height-2*padding)/yrange);
  const offsetX=(width-xrange*scale)/2,offsetY=(height-yrange*scale)/2;
  return {width,height,extent:{left,right,top,bottom},
    items:projected.map(v=>({...v,points:v.points.map(p=>({x:(p.x-left)*scale+offsetX,y:(p.y-top)*scale+offsetY}))}))};
}
