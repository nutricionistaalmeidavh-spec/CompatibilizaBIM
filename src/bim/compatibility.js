const MODES = new Set(['intersection', 'collision', 'clearance']);

function number(value, name) {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new TypeError(`${name} deve ser numérico`);
  return result;
}

function box(element) {
  const b = element?.bbox || element?.bounds;
  if (!b || !Array.isArray(b.min) || !Array.isArray(b.max) || b.min.length !== 3 || b.max.length !== 3) {
    throw new TypeError('Cada elemento BIM precisa de bbox.min e bbox.max XYZ');
  }
  return { min: b.min.map((v) => number(v, 'bbox')), max: b.max.map((v) => number(v, 'bbox')) };
}

function overlap(a, b, tolerance = 0) {
  return a.min.every((v, i) => v <= b.max[i] + tolerance && a.max[i] >= b.min[i] - tolerance);
}

function gap(a, b) {
  return Math.sqrt(a.min.reduce((sum, value, i) => sum + Math.max(b.min[i] - a.max[i], a.min[i] - b.max[i], 0) ** 2, 0));
}

export function validarCabecalhoIfc(texto) {
  const header = String(texto ?? '').slice(0, 4096);
  return { valido: /^\s*ISO-10303-21\s*;/m.test(header) && /HEADER\s*;/i.test(header), formato: 'IFC-SPF' };
}

export function criarModeloBim({ id, nome, disciplina = 'não definida', elementos = [] } = {}) {
  if (!id || !nome) throw new TypeError('Modelo BIM exige id e nome');
  return { id: String(id), nome: String(nome), disciplina: String(disciplina), elementos: elementos.map((item) => ({ ...item, bbox: box(item) })) };
}

export function detectarConflitosBim(modeloA, modeloB, { modo = 'intersection', tolerancia = 0.002, afastamento = 0.05 } = {}) {
  if (!MODES.has(modo)) throw new RangeError(`Modo BIM inválido: ${modo}`);
  const tolerance = number(tolerancia, 'tolerância');
  const clearance = number(afastamento, 'afastamento');
  const conflitos = [];
  for (const a of modeloA.elementos) for (const b of modeloB.elementos) {
    const ba = box(a); const bb = box(b); const distancia = gap(ba, bb);
    const encontrado = modo === 'clearance' ? distancia <= clearance : overlap(ba, bb, modo === 'intersection' ? tolerance : 0);
    if (encontrado) conflitos.push({ indice: conflitos.length + 1, modo, aGlobalId: a.globalId || a.id || '', bGlobalId: b.globalId || b.id || '', aClasse: a.ifcClass || '', bClasse: b.ifcClass || '', aNome: a.name || null, bNome: b.name || null, distanciaM: distancia, ponto: ba.min.map((v, i) => (Math.max(v, bb.min[i]) + Math.min(ba.max[i], bb.max[i])) / 2) });
  }
  return conflitos;
}

export function resumirCompatibilizacao(modeloA, modeloB, opcoes = {}) {
  const conflitos = detectarConflitosBim(modeloA, modeloB, opcoes);
  return { modeloA: modeloA.nome, modeloB: modeloB.nome, modo: opcoes.modo || 'intersection', totalConflitos: conflitos.length, conflitos, geradoEm: new Date().toISOString() };
}
