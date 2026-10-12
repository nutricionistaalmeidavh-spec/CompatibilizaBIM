export const STUDIO_ROUTES=Object.freeze([
  {key:'Obras',section:'Projetos'},
  {key:'BIM',section:'Projetos'},
  {key:'Estruturas',section:'Projetos'},
  {key:'Cálculos',section:'Engenharia'},
  {key:'Qualidade',section:'Engenharia'},
  {key:'Operação',section:'Execução'},
  {key:'RDO',section:'Execução'},
  {key:'Financeiro',section:'Execução'}
]);
const routes=new Map(STUDIO_ROUTES.map(route=>[route.key,route]));
export function normalizeStudioRoute(value){
  if(value==='Revisão')return 'BIM'; // old saved session links
  if(value==='Histórico')return 'Obras';
  return routes.has(value)?value:'Obras';
}
export function activeSection(value){return routes.get(normalizeStudioRoute(value)).section;}
export function groupedRoutes(){return [...new Set(STUDIO_ROUTES.map(route=>route.section))].map(section=>({
 section, routes:STUDIO_ROUTES.filter(route=>route.section===section)
}));}
