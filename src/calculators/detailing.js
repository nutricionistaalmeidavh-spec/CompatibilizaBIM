// Quantitativos preliminares para detalhamento. Não gera projeto executivo.
export function calcularDetalhamentoArmadura(input = {}) {
  const comprimento = Number(input.comprimento); const barras = Number(input.quantidadeBarras); const diametro = Number(input.diametroMm); const cobrimento = Number(input.cobrimentoMm ?? 30); const espacamento = Number(input.espacamentoEstribosMm ?? 200);
  if (![comprimento, barras, diametro, cobrimento, espacamento].every(Number.isFinite) || comprimento <= 0 || barras <= 0 || diametro <= 0 || cobrimento < 0 || espacamento <= 0) throw new Error('Dimensões, barras, diâmetro e espaçamento devem ser válidos.');
  const pesoLinear = (Math.PI * (diametro / 1000) ** 2 / 4) * 7850; const comprimentoTotal = comprimento * barras; const massa = comprimentoTotal * pesoLinear; const estribos = Math.ceil(comprimento * 1000 / espacamento) + 1;
  return { resultados: { comprimentoTotal, pesoLinear, massa, quantidadeEstribos: estribos, comprimentoUtil: Math.max(comprimento * 1000 - 2 * cobrimento, 0) }, metadados: { unidade: 'SI', avisos: ['Quantitativo preliminar; revisar ancoragens, emendas, taxas mínimas e detalhamento conforme norma aplicável.'] } };
}

export function gerarListaAco(barras = []) {
  if (!Array.isArray(barras) || barras.length === 0) throw new Error('Informe ao menos uma barra para gerar a lista de aço.');
  return barras.map((barra, index) => { const quantidade = Number(barra.quantidade); const diametroMm = Number(barra.diametroMm); const comprimentoM = Number(barra.comprimentoM); if (![quantidade, diametroMm, comprimentoM].every(Number.isFinite) || quantidade <= 0 || diametroMm <= 0 || comprimentoM <= 0) throw new Error(`Barra ${index + 1} possui dados inválidos.`); const massa = quantidade * comprimentoM * (Math.PI * (diametroMm / 1000) ** 2 / 4) * 7850; return { marca: barra.marca ?? `B${index + 1}`, quantidade, diametroMm, comprimentoM, comprimentoTotalM: quantidade * comprimentoM, massaKg: massa }; });
}

export function gerarQuadroFormas(elementos = []) {
  if (!Array.isArray(elementos) || elementos.length === 0) throw new Error('Informe elementos para gerar o quadro de formas.');
  return elementos.map((elemento, index) => { const comprimento = Number(elemento.comprimento); const largura = Number(elemento.largura); const altura = Number(elemento.altura); if (![comprimento, largura, altura].every(Number.isFinite) || comprimento <= 0 || largura <= 0 || altura <= 0) throw new Error(`Elemento ${index + 1} possui dimensões inválidas.`); return { identificacao: elemento.identificacao ?? `E${index + 1}`, volumeM3: comprimento * largura * altura, areaFormaM2: 2 * (comprimento * altura + largura * altura) }; });
}
