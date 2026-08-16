// Solver linear-elástico de pórtico plano 2D.
// Unidades coerentes: força, comprimento e momento devem usar o mesmo sistema.

function zeros(size) { return Array.from({ length: size }, () => Array(size).fill(0)); }
function addMatrix(target, source, dofs) { for (let row = 0; row < dofs.length; row += 1) for (let col = 0; col < dofs.length; col += 1) target[dofs[row]][dofs[col]] += source[row][col]; }
function multiply(a, b) { return a.map((row) => b[0].map((_, col) => row.reduce((sum, value, index) => sum + value * b[index][col], 0))); }
function transpose(a) { return a[0].map((_, col) => a.map((row) => row[col])); }
function solveLinearSystem(matrix, vector) {
  const a = matrix.map((row, index) => [...row, vector[index]]); const n = vector.length;
  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot; for (let row = pivot + 1; row < n; row += 1) if (Math.abs(a[row][pivot]) > Math.abs(a[best][pivot])) best = row;
    if (Math.abs(a[best][pivot]) < 1e-12) throw new Error('Modelo instável ou com apoios insuficientes.');
    [a[pivot], a[best]] = [a[best], a[pivot]];
    for (let row = pivot + 1; row < n; row += 1) { const factor = a[row][pivot] / a[pivot][pivot]; for (let col = pivot; col <= n; col += 1) a[row][col] -= factor * a[pivot][col]; }
  }
  const result = Array(n).fill(0); for (let row = n - 1; row >= 0; row -= 1) result[row] = (a[row][n] - a[row].slice(row + 1, n).reduce((sum, value, index) => sum + value * result[row + index + 1], 0)) / a[row][row]; return result;
}

function elementMatrices(element, nodes) {
  const start = nodes.get(element.nodeI); const end = nodes.get(element.nodeJ); if (!start || !end) throw new Error(`Elemento ${element.id} referencia nó inexistente.`);
  const dx = end.x - start.x; const dy = end.y - start.y; const length = Math.hypot(dx, dy); if (!(length > 0)) throw new Error(`Elemento ${element.id} possui comprimento nulo.`);
  const c = dx / length; const s = dy / length; const e = Number(element.E); const area = Number(element.A); const inertia = Number(element.I); if (![e, area, inertia].every((value) => Number.isFinite(value) && value > 0)) throw new Error(`Elemento ${element.id} possui E, A ou I inválido.`);
  const axial = e * area / length; const b = e * inertia; const l2 = length ** 2; const l3 = length ** 3;
  const local = [[axial,0,0,-axial,0,0],[0,12*b/l3,6*b/l2,0,-12*b/l3,6*b/l2],[0,6*b/l2,4*b/length,0,-6*b/l2,2*b/length],[-axial,0,0,axial,0,0],[0,-12*b/l3,-6*b/l2,0,12*b/l3,-6*b/l2],[0,6*b/l2,2*b/length,0,-6*b/l2,4*b/length]];
  const t = [[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]];
  return { length, local, transform: t, global: multiply(transpose(t), multiply(local, t)) };
}

export function analisarPorticoPlano2D(modelo = {}) {
  const nodes = new Map((modelo.nos ?? []).map((node) => [node.id, node])); const elements = modelo.elementos ?? []; if (!nodes.size || !elements.length) throw new Error('O pórtico precisa de pelo menos dois nós e um elemento.');
  const ids = [...nodes.keys()]; const index = new Map(ids.flatMap((id, position) => [[`${id}:ux`, position * 3], [`${id}:uy`, position * 3 + 1], [`${id}:rz`, position * 3 + 2]])); const size = ids.length * 3; const stiffness = zeros(size); const load = Array(size).fill(0); const supports = new Set();
  for (const node of nodes.values()) { const loads = node.loads ?? {}; load[index.get(`${node.id}:ux`)] = Number(loads.fx ?? 0); load[index.get(`${node.id}:uy`)] = Number(loads.fy ?? 0); load[index.get(`${node.id}:rz`)] = Number(loads.mz ?? 0); for (const dof of ['ux','uy','rz']) if (node.supports?.[dof]) supports.add(index.get(`${node.id}:${dof}`)); }
  const details = elements.map((element) => { const matrices = elementMatrices(element, nodes); const dofs = [`${element.nodeI}:ux`,`${element.nodeI}:uy`,`${element.nodeI}:rz`,`${element.nodeJ}:ux`,`${element.nodeJ}:uy`,`${element.nodeJ}:rz`].map((key) => index.get(key)); addMatrix(stiffness, matrices.global, dofs); return { element, matrices, dofs }; });
  if (!supports.size) throw new Error('Defina pelo menos um apoio no modelo.');
  for (const dof of supports) { for (let i = 0; i < size; i += 1) { stiffness[dof][i] = 0; stiffness[i][dof] = 0; } stiffness[dof][dof] = 1; load[dof] = 0; }
  const displacement = solveLinearSystem(stiffness, load); const elementResults = details.map(({ element, matrices, dofs }) => { const globalDisplacement = dofs.map((dof) => displacement[dof]); const localDisplacement = multiply(matrices.transform, globalDisplacement.map((value) => [value])).map((row) => row[0]); const forces = multiply(matrices.local, localDisplacement.map((value) => [value])).map((row) => row[0]); return { id: element.id, length: matrices.length, localDisplacement, endForces: forces }; });
  return { displacement: Object.fromEntries(ids.map((id) => [id, { ux: displacement[index.get(`${id}:ux`)], uy: displacement[index.get(`${id}:uy`)], rz: displacement[index.get(`${id}:rz`)] }])), elements: elementResults, dofCount: size };
}
