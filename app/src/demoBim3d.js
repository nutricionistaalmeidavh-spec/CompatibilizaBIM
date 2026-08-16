import { buscarProjetoBim, atualizarElementosModeloBimProjeto, atualizarConflitosBimProjeto, listarModelosEstruturais, salvarModeloEstrutural, salvarPavimentoEstrutural, salvarNoEstrutural, salvarElementoEstrutural } from '../../storage/sqliteStore.js';

const box = (globalId, name, ifcClass, disciplina, min, max) => ({ globalId, name, ifcClass, disciplina, bbox: { min, max } });

function gerarEstrutura() {
  const elementos = [];
  const xs = [0, 4, 8]; const ys = [0, 4, 8]; const alturas = [0, 3.2, 6.4, 9.6];
  for (let level = 0; level < alturas.length - 1; level += 1) {
    const z0 = alturas[level]; const z1 = alturas[level + 1];
    xs.forEach((x) => ys.forEach((y) => elementos.push(box(`EST-C-${level}-${x}-${y}`, `Pilar ${x}/${y} · nível ${level + 1}`, 'IfcColumn', 'Estrutura', [x - .18, y - .18, z0], [x + .18, y + .18, z1]))));
    xs.forEach((x) => { for (let y = 0; y < ys.length - 1; y += 1) elementos.push(box(`EST-BX-${level}-${x}-${y}`, `Viga X ${x}/${y} · nível ${level + 1}`, 'IfcBeam', 'Estrutura', [x - .18, ys[y] - .16, z1 - .22], [x + .18, ys[y + 1] + .16, z1 + .22])); });
    ys.forEach((y) => { for (let x = 0; x < xs.length - 1; x += 1) elementos.push(box(`EST-BY-${level}-${x}-${y}`, `Viga Y ${x}/${y} · nível ${level + 1}`, 'IfcBeam', 'Estrutura', [xs[x] - .16, y - .18, z1 - .22], [xs[x + 1] + .16, y + .18, z1 + .22])); });
    elementos.push(box(`EST-LAJE-${level}`, `Laje do nível ${level + 1}`, 'IfcSlab', 'Estrutura', [-.2, -.2, z1 - .10], [8.2, 8.2, z1]));
  }
  elementos.push(box('EST-FUND-01', 'Bloco de fundação principal', 'IfcFooting', 'Estrutura', [-.7, -.7, -.55], [1.1, 1.1, 0]));
  return elementos;
}

function gerarHidraulica() {
  const elementos = [];
  const alturas = [2.65, 5.85, 9.05];
  alturas.forEach((z, level) => {
    elementos.push(box(`HID-PRUM-${level}`, `Prumada hidráulica · nível ${level + 1}`, 'IfcPipeSegment', 'Hidráulica', [1.75, 1.75, z - 1.45], [2.05, 2.05, z + .5]));
    elementos.push(box(`HID-AGUA-${level}`, `Tubo água fria DN25 · nível ${level + 1}`, 'IfcPipeSegment', 'Hidráulica', [1.88, 1.88, z], [6.2, 2.12, z + .18]));
    elementos.push(box(`HID-ESG-${level}`, `Tubo esgoto DN50 · nível ${level + 1}`, 'IfcPipeSegment', 'Hidráulica', [2.0, 2.0, z + .42], [2.2, 6.2, z + .64]));
    elementos.push(box(`HID-CHU-${level}`, `Ramais de chuveiros · nível ${level + 1}`, 'IfcPipeSegment', 'Hidráulica', [5.5, 1.1, z - .22], [7.8, 1.35, z]));
  });
  elementos.push(box('HID-RES-01', 'Reservatório superior', 'IfcTank', 'Hidráulica', [6.5, 6.5, 9.6], [8, 8, 10.6]));
  return elementos;
}

function gerarConflitos() {
  return [
    { indice: 1, modo: 'intersection', aGlobalId: 'EST-BX-0-0-0', bGlobalId: 'HID-AGUA-0', aClasse: 'IfcBeam', bClasse: 'IfcPipeSegment', aNome: 'Viga X 0/0 · nível 1', bNome: 'Tubo água fria DN25 · nível 1', ponto: [2.2, 2, 3.0], distanciaM: 0, gravidade: 'high', status: 'aberto' },
    { indice: 2, modo: 'intersection', aGlobalId: 'EST-C-1-4-4', bGlobalId: 'HID-ESG-1', aClasse: 'IfcColumn', bClasse: 'IfcPipeSegment', aNome: 'Pilar 4/4 · nível 2', bNome: 'Tubo esgoto DN50 · nível 2', ponto: [4, 4, 6.3], distanciaM: 0, gravidade: 'high', status: 'aberto' },
    { indice: 3, modo: 'clearance', aGlobalId: 'EST-LAJE-2', bGlobalId: 'HID-CHU-2', aClasse: 'IfcSlab', bClasse: 'IfcPipeSegment', aNome: 'Laje do nível 3', bNome: 'Ramais de chuveiros · nível 3', ponto: [6.2, 1.2, 9.3], distanciaM: .025, gravidade: 'medium', status: 'aberto' },
  ];
}

export function enriquecerDemoBim3D(db) {
  const projeto = buscarProjetoBim(db, 'demo-bim-001');
  if (!projeto || projeto.modelos.length < 2) return;
  const estrutura = projeto.modelos.find((item) => item.disciplina === 'Estrutura') || projeto.modelos[0];
  const hidraulica = projeto.modelos.find((item) => item.disciplina === 'Hidráulica') || projeto.modelos[1];
  if ((estrutura.elementos ?? []).length < 20) atualizarElementosModeloBimProjeto(db, estrutura.id, gerarEstrutura());
  if ((hidraulica.elementos ?? []).length < 10) atualizarElementosModeloBimProjeto(db, hidraulica.id, gerarHidraulica());
  const atualizado = buscarProjetoBim(db, 'demo-bim-001');
  if (atualizado.analises[0] && atualizado.analises[0].conflitos.length < 3) atualizarConflitosBimProjeto(db, atualizado.analises[0].id, gerarConflitos());
}

export function garantirModeloEstruturalDemo(db, obraId) {
  if (!obraId || listarModelosEstruturais(db, obraId).length) return;
  const modeloId = salvarModeloEstrutural(db, obraId, { id: 'demo-estrutura-3d-001', nome: 'Edifício demo · pórtico espacial', norma: 'NBR 6118:2014', unidade: 'kN-m', status: 'rascunho' });
  const nos = [
    ['N1', 0, 0, 0, true], ['N2', 4, 0, 0, true], ['N3', 8, 0, 0, true],
    ['N4', 0, 4, 0, true], ['N5', 4, 4, 0, true], ['N6', 8, 4, 0, true],
    ['N7', 0, 0, 3.2, false], ['N8', 4, 0, 3.2, false], ['N9', 8, 0, 3.2, false],
    ['N10', 0, 4, 3.2, false], ['N11', 4, 4, 3.2, false], ['N12', 8, 4, 3.2, false],
  ];
  nos.forEach(([nome, x, y, z, apoio]) => salvarNoEstrutural(db, modeloId, { id: `demo-no-${nome}`, nome, x, y, z, supports: apoio ? { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true } : {}, loads: apoio ? {} : { fz: -12 } }));
  const barras = [['N1', 'N2', 'viga'], ['N2', 'N3', 'viga'], ['N4', 'N5', 'viga'], ['N5', 'N6', 'viga'], ['N1', 'N4', 'viga'], ['N2', 'N5', 'viga'], ['N3', 'N6', 'viga'], ['N1', 'N7', 'pilar'], ['N2', 'N8', 'pilar'], ['N3', 'N9', 'pilar'], ['N4', 'N10', 'pilar'], ['N5', 'N11', 'pilar'], ['N6', 'N12', 'pilar'], ['N7', 'N8', 'viga'], ['N8', 'N9', 'viga'], ['N10', 'N11', 'viga'], ['N11', 'N12', 'viga'], ['N7', 'N10', 'viga'], ['N8', 'N11', 'viga'], ['N9', 'N12', 'viga']];
  barras.forEach(([nodeI, nodeJ, tipo], index) => salvarElementoEstrutural(db, modeloId, { id: `demo-barra-${index + 1}`, tipo, nome: `${tipo === 'pilar' ? 'Pilar' : 'Viga'} ${index + 1}`, material: 'concreto C30', secao: { A: tipo === 'pilar' ? .09 : .06, I: .00045 }, geometria: { nodeI: `demo-no-${nodeI}`, nodeJ: `demo-no-${nodeJ}` }, status: 'rascunho' }));
  salvarPavimentoEstrutural(db, modeloId, { id: 'demo-pav-01', nome: 'Pavimento térreo', nivel: 0, altura: 3.2 });
  salvarPavimentoEstrutural(db, modeloId, { id: 'demo-pav-02', nome: 'Pavimento 01', nivel: 1, altura: 3.2 });
}
