// Consistent equivalent nodal loads for Euler-Bernoulli beams.
// Signed input: in planar/3D frames distributed and concentrated forces act in
// GLOBAL Y; centered moments act around GLOBAL Z. Position is midpoint.
function add(v, i, value) { v[i] += value; }
export function localLoad2D(kind, value, L, c, s) {
  const f = Array(6).fill(0);
  if (kind === 'momento') {
    add(f, 1, -1.5 * value / L); add(f, 2, -.25 * value);
    add(f, 4, 1.5 * value / L); add(f, 5, -.25 * value);
    return f;
  }
  const axial = s * value, transverse = c * value;
  const scale = kind === 'distribuida' ? L : 1;
  const momentScale = kind === 'distribuida' ? L * L / 12 : L / 8;
  add(f, 0, axial * scale / 2); add(f, 3, axial * scale / 2);
  add(f, 1, transverse * scale / 2); add(f, 4, transverse * scale / 2);
  add(f, 2, transverse * momentScale); add(f, 5, -transverse * momentScale);
  return f;
}
export function localLoad3D(kind, value, L, axes) {
  const f = Array(12).fill(0);
  if (kind === 'momento') {
    const [mx, my, mz] = axes.map(axis => axis[2] * value);
    add(f, 3, mx / 2); add(f, 9, mx / 2);
    // Mz: virtual work on local-y deflection slope.
    add(f, 1, -1.5 * mz / L); add(f, 5, -.25 * mz);
    add(f, 7, 1.5 * mz / L); add(f, 11, -.25 * mz);
    // My: opposite sign for local-z bending rotation about local Y.
    add(f, 2, 1.5 * my / L); add(f, 4, .25 * my);
    add(f, 8, -1.5 * my / L); add(f, 10, .25 * my);
    return f;
  }
  const [axial, qy, qz] = axes.map(axis => axis[1] * value);
  const scale = kind === 'distribuida' ? L : 1;
  const momentScale = kind === 'distribuida' ? L * L / 12 : L / 8;
  add(f, 0, axial * scale / 2); add(f, 6, axial * scale / 2);
  add(f, 1, qy * scale / 2); add(f, 7, qy * scale / 2);
  add(f, 5, qy * momentScale); add(f, 11, -qy * momentScale);
  add(f, 2, qz * scale / 2); add(f, 8, qz * scale / 2);
  add(f, 4, -qz * momentScale); add(f, 10, qz * momentScale);
  return f;
}
