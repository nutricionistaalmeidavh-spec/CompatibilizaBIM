function minimo(fck) { return fck <= 25 ? 0.0015 : fck <= 30 ? 0.00173 : fck <= 35 ? 0.00201 : fck <= 40 ? 0.0023 : fck <= 45 ? 0.00259 : 0.00288; }
function comum(i, md, h, largura = 100) {
  const d = h - i.cobrimentoCM; const fcd = (i.fckMPa / 10) / 1.4; const fyd = (i.fykMPa / 10) / 1.15;
  const kmd = md * 100 / (largura * d ** 2 * fcd); const disc = 0.4624 - 1.088 * kmd; const xi = disc < 0 ? null : (0.68 - Math.sqrt(disc)) / 0.544; const z = xi == null ? null : d - 0.4 * xi * d; const asCalc = z == null ? null : md * 100 / (fyd * z); const asMin = minimo(i.fckMPa) * largura * h;
  return { d, fcd, fyd, kmd, xi, z, asCalc, asMin, asAdotada: asCalc == null ? null : Math.max(asCalc, asMin) };
}
export function calcularLajeUmaDirecao(values = {}) {
  const i = { vaoM: 3, espessuraCM: 10, cobrimentoCM: 2.5, cargaPermanenteKNM2: 2, cargaAcidentalKNM2: 2, fckMPa: 25, fykMPa: 500, apoio: 'Biapoiada', ...values };
  const pd = (i.cargaPermanenteKNM2 + i.cargaAcidentalKNM2) * 1.4; const md = i.apoio === 'Engastada-Apoiada' ? pd * i.vaoM ** 2 / 14.22 : i.apoio === 'Biengastada' ? pd * i.vaoM ** 2 / 24 : pd * i.vaoM ** 2 / 8;
  return { entrada: i, resultados: { pd, md, ...comum(i, md, i.espessuraCM) }, metadados: { referencia: 'Planilha_Calculo_Lajes_NBR6118.xlsx', modelo: 'Laje maciça em 1 direção', normaDeclarada: 'NBR 6118:2014' } };
}
export function calcularLajeDuasDirecoes(values = {}) {
  const i = { vaoMenorM: 4, vaoMaiorM: 4.8, espessuraCM: 10, cobrimentoCM: 2.5, cargaPermanenteKNM2: 2, cargaAcidentalKNM2: 2, fckMPa: 25, fykMPa: 500, ...values };
  const lambda = i.vaoMaiorM / i.vaoMenorM; const mux = 4.6; const muy = 3.2; const pd = (i.cargaPermanenteKNM2 + i.cargaAcidentalKNM2) * 1.4; const mdx = mux * pd * i.vaoMenorM ** 2 / 100; const mdy = muy * pd * i.vaoMenorM ** 2 / 100;
  return { entrada: i, resultados: { lambda, mux, muy, pd, mdx, mdy, x: comum(i, mdx, i.espessuraCM), y: comum(i, mdy, i.espessuraCM) }, metadados: { referencia: 'Planilha_Calculo_Lajes_NBR6118.xlsx', modelo: 'Laje maciça em 2 direções — caso 1', normaDeclarada: 'NBR 6118:2014' } };
}
