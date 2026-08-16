// Modelo espacial linear inicial (treliça 3D).
// Cada nó possui ux, uy e uz; elementos trabalham axialmente.
// Não substitui o pórtico espacial completo com rotações e efeitos de segunda ordem.

function solveLinearSystem(matrix, vector) {
  const a = matrix.map((row, index) => [...row, vector[index]]); const n = vector.length;
  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < n; row += 1) if (Math.abs(a[row][pivot]) > Math.abs(a[best][pivot])) best = row;
    if (Math.abs(a[best][pivot]) < 1e-12) throw new Error('Modelo espacial instável ou com apoios insuficientes.');
    [a[pivot], a[best]] = [a[best], a[pivot]];
    for (let row = pivot + 1; row < n; row += 1) {
      const factor = a[row][pivot] / a[pivot][pivot];
      for (let col = pivot; col <= n; col += 1) a[row][col] -= factor * a[pivot][col];
    }
  }
  const result = Array(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) result[row] = (a[row][n] - a[row].slice(row + 1, n).reduce((sum, value, index) => sum + value * result[row + index + 1], 0)) / a[row][row];
  return result;
}

function addBarStiffness(matrix, dofs, direction, stiffness) {
  const [l, m, n] = direction; const block = [[l*l,l*m,l*n], [l*m,m*m,m*n], [l*n,m*n,n*n]];
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
    matrix[dofs[i]][dofs[j]] += stiffness * block[i][j];
    matrix[dofs[i]][dofs[j + 3]] -= stiffness * block[i][j];
    matrix[dofs[i + 3]][dofs[j]] -= stiffness * block[i][j];
    matrix[dofs[i + 3]][dofs[j + 3]] += stiffness * block[i][j];
  }
}

export function analisarModeloEspacial3D(modelo = {}) {
  const nodes = new Map((modelo.nos ?? []).map((node) => [node.id, node]));
  const elements = modelo.elementos ?? [];
  if (nodes.size < 2 || !elements.length) throw new Error('O modelo espacial precisa de pelo menos dois nós e um elemento.');
  const ids = [...nodes.keys()]; const index = new Map(ids.flatMap((id, position) => [['x', position * 3], ['y', position * 3 + 1], ['z', position * 3 + 2]].map(([axis, value]) => [`${id}:${axis}`, value])));
  const size = ids.length * 3; const stiffness = Array.from({ length: size }, () => Array(size).fill(0)); const load = Array(size).fill(0); const supports = new Set();
  for (const node of nodes.values()) {
    const loads = node.loads ?? {};
    for (const axis of ['x', 'y', 'z']) { load[index.get(`${node.id}:${axis}`)] = Number(loads[`f${axis}`] ?? 0); if (node.supports?.[axis] || node.supports?.[`u${axis}`]) supports.add(index.get(`${node.id}:${axis}`)); }
  }
  const details = elements.map((element) => {
    const start = nodes.get(element.nodeI); const end = nodes.get(element.nodeJ); if (!start || !end) throw new Error(`Elemento ${element.id} referencia nó inexistente.`);
    const dx = Number(end.x) - Number(start.x); const dy = Number(end.y) - Number(start.y); const dz = Number(end.z) - Number(start.z); const length = Math.hypot(dx, dy, dz); const e = Number(element.E); const area = Number(element.A);
    if (!(length > 0) || !(e > 0) || !(area > 0)) throw new Error(`Elemento ${element.id} possui geometria, E ou A inválido.`);
    const direction = [dx / length, dy / length, dz / length]; addBarStiffness(stiffness, [`${element.nodeI}:x`,`${element.nodeI}:y`,`${element.nodeI}:z`,`${element.nodeJ}:x`,`${element.nodeJ}:y`,`${element.nodeJ}:z`].map((key) => index.get(key)), direction, e * area / length);
    return { element, length, direction };
  });
  if (!supports.size) throw new Error('Defina pelo menos um apoio espacial.');
  for (const dof of supports) { for (let i = 0; i < size; i += 1) { stiffness[dof][i] = 0; stiffness[i][dof] = 0; } stiffness[dof][dof] = 1; load[dof] = 0; }
  const displacement = solveLinearSystem(stiffness, load);
  const elementResults = details.map(({ element, length, direction }) => { const dofs = [`${element.nodeI}:x`,`${element.nodeI}:y`,`${element.nodeI}:z`,`${element.nodeJ}:x`,`${element.nodeJ}:y`,`${element.nodeJ}:z`].map((key) => index.get(key)); const delta = [displacement[dofs[3]] - displacement[dofs[0]], displacement[dofs[4]] - displacement[dofs[1]], displacement[dofs[5]] - displacement[dofs[2]]]; const axialForce = Number(element.E) * Number(element.A) / length * (delta[0] * direction[0] + delta[1] * direction[1] + delta[2] * direction[2]); return { id: element.id, length, axialForce, stress: axialForce / Number(element.A) }; });
  return { tipo: 'trelica-espacial-3d', displacement: Object.fromEntries(ids.map((id) => [id, { ux: displacement[index.get(`${id}:x`)], uy: displacement[index.get(`${id}:y`)], uz: displacement[index.get(`${id}:z`)] }])), elements: elementResults, dofCount: size, avisos: ['Modelo espacial linear inicial: elementos trabalham apenas à tração/compressão.', 'Para projeto executivo, ainda é necessária a análise de pórtico espacial com rotações, flexão, torção e combinações normativas.'] };
}
