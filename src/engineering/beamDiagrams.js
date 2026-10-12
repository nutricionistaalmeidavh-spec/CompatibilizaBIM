// Analytical diagrams for a simply supported beam with uniform characteristic load.
// Not a replacement for the frame solver, load combinations or normative verification.
export function diagramasVigaBiapoiada(input) {
  const L=Number(input?.vaoM);
  const g=Number(input?.cargaPermanenteKNM),q=Number(input?.cargaAcidentalKNM);
  if(![L,g,q].every(Number.isFinite)||L<=0||g<0||q<0)
    throw new Error('Vão e cargas devem ser válidos para o diagrama.');
  const load=g+q;
  const points=Array.from({length:21},(_,i)=>i*L/20);
  const momento=points.map(x=>({x,y:load*x*(L-x)/2}));
  const cortante=points.map(x=>({x,y:load*(L/2-x)}));
  return {momento,cortante,momentoMaxKNM:load*L*L/8,cortanteMaxKN:load*L/2,loadKNM:load,vaoM:L,
    ressalva:'Viga biapoiada idealizada, carga uniformemente distribuída característica; não é envoltória ELU/ELS.'};
}
