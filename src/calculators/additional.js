const n = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const status = (ok, yes = 'OK', no = 'REVISAR') => ok ? yes : no;
const meta = (referencia, norma) => ({ referencia, normaDeclarada: norma, observacao: 'Pré-dimensionamento baseado na planilha de referência; requer conferência técnica.' });

export function calcularBaciaDetencao(values = {}) {
  const i = { areaHa: n(values.areaHa, 10), coeficienteEscoamento: n(values.coeficienteEscoamento, .65), intensidadeMMH: n(values.intensidadeMMH, 100), tempoConcentracaoMin: n(values.tempoConcentracaoMin, 25), vazaoRestricaoLS: n(values.vazaoRestricaoLS, 150) };
  const vazaoPicoM3S = i.coeficienteEscoamento * i.intensidadeMMH * i.areaHa / 360;
  const vazaoRestricaoM3S = i.vazaoRestricaoLS / 1000;
  const tempoBaseS = 2 * i.tempoConcentracaoMin * 60;
  const volumeEntradaM3 = .5 * vazaoPicoM3S * tempoBaseS;
  const volumeAmortecimentoM3 = Math.max(.5 * tempoBaseS * (vazaoPicoM3S - vazaoRestricaoM3S), 0);
  return { entrada: i, resultados: { vazaoPicoM3S, vazaoRestricaoM3S, volumeEntradaM3, volumeAmortecimentoM3, volumeProjetoM3: volumeAmortecimentoM3 * 1.2 }, verificacoes: { necessidade: status(vazaoPicoM3S > vazaoRestricaoM3S, 'BACIA NECESSÁRIA', 'BACIA DISPENSÁVEL') }, metadados: meta('Planilha_Bacia_Detencao.xlsx', 'Método do hidrograma triangular simplificado') };
}

export function calcularBlocoDuasEstacas(values = {}) {
  const i = { cargaKN: n(values.cargaKN, 800), capacidadeEstacaKN: n(values.capacidadeEstacaKN, 450), diametroEstacaCM: n(values.diametroEstacaCM, 40), espacamentoCM: n(values.espacamentoCM, 100), larguraPilarCM: n(values.larguraPilarCM, 30), alturaBlocoCM: n(values.alturaBlocoCM, 80), cobrimentoCM: n(values.cobrimentoCM, 7), fckMPa: n(values.fckMPa, 25), fykMPa: n(values.fykMPa, 500) };
  const nd = 1.4 * i.cargaKN, reacao = nd / 2, d = i.alturaBlocoCM - i.cobrimentoCM, a = i.espacamentoCM / 2 - i.larguraPilarCM / 4, theta = Math.atan(d / a) * 180 / Math.PI, t = reacao * a / d, fyd = i.fykMPa / 11.5, as = t / fyd, asMin = .0015 * i.larguraPilarCM * i.alturaBlocoCM, fcd = i.fckMPa / 14, alphaV2 = 1 - i.fckMPa / 250, sigmaRd2 = .85 * alphaV2 * fcd, sigmaSd = nd / (i.larguraPilarCM ** 2 * Math.sin(theta * Math.PI / 180) ** 2);
  return { entrada: i, resultados: { nd, reacao, d, a, theta, t, as, asMin, asAdotada: Math.max(as, asMin), sigmaRd2, sigmaSd }, verificacoes: { estacas: status(reacao <= i.capacidadeEstacaKN * 1.4, 'OK', 'AUMENTAR CAPACIDADE'), angulo: status(theta >= 40 && theta <= 55, 'OK', 'FORA DA FAIXA 40°–55°'), biela: status(sigmaSd <= sigmaRd2, 'OK', 'BIELA INSUFICIENTE') }, metadados: meta('Planilha_Bloco_2_Estacas.xlsx', 'NBR 6118:2014 — método das bielas de Blévot') };
}

export function calcularBombaCentrifuga(values = {}) {
  const i = { vazaoLS: n(values.vazaoLS, 2.5), alturaRecalqueM: n(values.alturaRecalqueM, 12), alturaSuccaoM: n(values.alturaSuccaoM, 2), perdaSuccaoM: n(values.perdaSuccaoM, .5), perdaRecalqueM: n(values.perdaRecalqueM, 3), rendimentoPct: n(values.rendimentoPct, 65), pressaoAtmosfericaM: n(values.pressaoAtmosfericaM, 10.33), pressaoVaporM: n(values.pressaoVaporM, .24) };
  const hg = i.alturaRecalqueM + i.alturaSuccaoM, hf = i.perdaSuccaoM + i.perdaRecalqueM, hman = hg + hf, ph = 9.81 * (i.vazaoLS / 1000) * hman, pabs = ph / (i.rendimentoPct / 100), npsh = i.pressaoAtmosfericaM - i.alturaSuccaoM - i.perdaSuccaoM - i.pressaoVaporM;
  return { entrada: i, resultados: { alturaGeometricaM: hg, perdaTotalM: hf, alturaManometricaM: hman, potenciaHidraulicaKW: ph, potenciaAbsorvidaKW: pabs, potenciaCV: pabs / .7355, potenciaMotorRecomendadaKW: pabs * 1.2, npshDisponivelM: npsh }, verificacoes: { npsh: status(npsh > 0, 'NPSHd POSITIVO', 'RISCO DE CAVITAÇÃO') }, metadados: meta('Planilha_Bombas_Centrifugas.xlsx', 'Hidráulica de bombas — comparar com curva do fabricante') };
}

export function calcularCalhasCondutores(values = {}) {
  const i = { areaM2: n(values.areaM2, 150), intensidadeMMH: n(values.intensidadeMMH, 150), manningN: n(values.manningN, .011), declividadePct: n(values.declividadePct, .5), larguraCM: n(values.larguraCM, 20), alturaCM: n(values.alturaCM, 10), diametroMM: n(values.diametroMM, 100), laminaCM: n(values.laminaCM, 5) };
  const q = i.intensidadeMMH * i.areaM2 / 60, am = i.larguraCM / 100 * i.alturaCM / 100, pm = i.larguraCM / 100 + 2 * i.alturaCM / 100, r = am / pm, qcalha = 1 / i.manningN * am * r ** (2 / 3) * Math.sqrt(i.declividadePct / 100) * 60000, ac = Math.PI * (i.diametroMM / 1000) ** 2 / 4, qcondutor = .62 * ac * Math.sqrt(2 * 9.81 * i.laminaCM / 100) * 60000;
  return { entrada: i, resultados: { vazaoProjetoLMin: q, capacidadeCalhaLMin: qcalha, capacidadeCondutorLMin: qcondutor }, verificacoes: { calha: status(q <= qcalha, 'OK', 'AUMENTAR CALHA'), condutor: status(q <= qcondutor, 'OK', 'AUMENTAR DIÂMETRO'), diametroMinimo: status(i.diametroMM >= 70, 'OK', 'ABAIXO DE 70 mm') }, metadados: meta('Planilha_Calhas_Condutores_NBR10844.xlsx', 'NBR 10844:1989') };
}

export function calcularCapacidadeEstaca(values = {}) {
  const i = { diametroCM: n(values.diametroCM, 40), comprimentoM: n(values.comprimentoM, 12), nsptPonta: n(values.nsptPonta, 18), nsptFuste: n(values.nsptFuste, 10), solo: values.solo || 'Areia', alpha: n(values.alpha, 1), beta: n(values.beta, 1) };
  const k = { Argila: 120, 'Silte Argiloso': 200, 'Silte Arenoso': 250, Areia: 400 }[i.solo] || 400, ap = Math.PI * (i.diametroCM / 100) ** 2 / 4, u = Math.PI * i.diametroCM / 100, rp = k * i.nsptPonta, rpTotal = i.alpha * rp * ap, rl = (i.nsptFuste / 3 + 1) * 10, rlTotal = i.beta * rl * u * i.comprimentoM, ultima = rpTotal + rlTotal, adm = Math.min(rpTotal / 4 + rlTotal / 1.3, ultima / 2);
  return { entrada: i, resultados: { areaPontaM2: ap, perimetroM: u, resistenciaPontaKN: rpTotal, resistenciaLateralKN: rlTotal, cargaUltimaKN: ultima, cargaAdmissivelKN: adm }, verificacoes: { nspt: status(i.nsptPonta >= 3 && i.nsptFuste >= 3, 'OK', 'SPT MUITO BAIXO') }, metadados: meta('Planilha_Capacidade_Carga_Estacas.xlsx', 'NBR 6122:2019 — Décourt-Quaresma') };
}

export function calcularCurvaIdf(values = {}) {
  const i = { a: n(values.a, 1200), b: n(values.b, .2), c: n(values.c, 15), d: n(values.d, .75), tempoRetornoAnos: n(values.tempoRetornoAnos, 10), duracaoMin: n(values.duracaoMin, 20), areaHa: n(values.areaHa, 5), coeficienteEscoamento: n(values.coeficienteEscoamento, .6) };
  const intensidade = i.a * i.tempoRetornoAnos ** i.b / (i.duracaoMin + i.c) ** i.d, pico = i.coeficienteEscoamento * intensidade * i.areaHa / 360;
  return { entrada: i, resultados: { intensidadeMMH: intensidade, vazaoPicoM3S: pico, vazaoPicoLS: pico * 1000 }, verificacoes: { parametros: 'CONFIRMAR PARÂMETROS LOCAIS' }, metadados: meta('Planilha_Curva_IDF.xlsx', 'Equação IDF local + método racional') };
}

export function calcularLajeNervurada(values = {}) {
  const i = { vaoM: n(values.vaoM, 4.5), espacamentoCM: n(values.espacamentoCM, 40), larguraNervuraCM: n(values.larguraNervuraCM, 10), alturaCM: n(values.alturaCM, 20), capaCM: n(values.capaCM, 4), cobrimentoCM: n(values.cobrimentoCM, 3), cargaPermanenteKNM2: n(values.cargaPermanenteKNM2, 1.5), cargaAcidentalKNM2: n(values.cargaAcidentalKNM2, 2), pesoConcretoKNM3: n(values.pesoConcretoKNM3, 25), fckMPa: n(values.fckMPa, 25), fykMPa: n(values.fykMPa, 500) };
  const vol = (i.larguraNervuraCM * i.alturaCM + (i.espacamentoCM - i.larguraNervuraCM) * i.capaCM) / (i.espacamentoCM * 100), gpp = vol * i.pesoConcretoKNM3, pd = 1.4 * (gpp + i.cargaPermanenteKNM2 + i.cargaAcidentalKNM2), pdN = pd * i.espacamentoCM / 100, md = pdN * i.vaoM ** 2 / 8, vd = pdN * i.vaoM / 2, d = i.alturaCM - i.cobrimentoCM, fcd = i.fckMPa / 14, fyd = i.fykMPa / 11.5, kmd = md * 100 / (i.espacamentoCM * d ** 2 * fcd), disc = .4624 - 1.088 * kmd, xi = disc < 0 ? null : (.68 - Math.sqrt(disc)) / .544, x = xi == null ? null : xi * d, z = x == null ? null : d - .4 * x, as = z == null ? null : md * 100 / (fyd * z), asMin = .0015 * i.larguraNervuraCM * i.alturaCM, tau = vd * 10 / (i.larguraNervuraCM * d), tauRd2 = .27 * (1 - i.fckMPa / 250) * (fcd * 10);
  return { entrada: i, resultados: { volumeConcretoM3M2: vol, pesoProprioKNM2: gpp, pdKNM2: pd, momentoKNM: md, cortanteKN: vd, alturaUtilCM: d, xi, profundidadeLNCM: x, asCalcCM2: as, asMinCM2: asMin, asAdotadaCM2: as == null ? null : Math.max(as, asMin), tauMPa: tau, tauRd2MPa: tauRd2 }, verificacoes: { secao: x == null ? 'REVISAR' : status(x <= i.capaCM, 'SEÇÃO RETANGULAR', 'SEÇÃO T VERDADEIRA'), cisalhamento: status(tau <= tauRd2, 'OK', 'AUMENTAR bw') }, metadados: meta('Planilha_Laje_Nervurada.xlsx', 'NBR 6118:2014') };
}

export function calcularLigacaoParafusada(values = {}) {
  const i = { forcaKN: n(values.forcaKN, 200), diametroMM: n(values.diametroMM, 19.05), fubMPa: n(values.fubMPa, 825), numeroParafusos: n(values.numeroParafusos, 4), planosCorte: n(values.planosCorte, 2), espessuraChapaMM: n(values.espessuraChapaMM, 9.5), fuChapaMPa: n(values.fuChapaMPa, 400), distanciaBordaMM: n(values.distanciaBordaMM, 35) };
  const ab = Math.PI * (i.diametroMM / 10) ** 2 / 4, fv = .4 * i.fubMPa * ab / 1.35 / 10, corte = fv * i.numeroParafusos * i.planosCorte, esmag = 2.4 * (i.diametroMM / 10) * (i.espessuraChapaMM / 10) * i.fuChapaMPa / 1.35 / 10, esmagTotal = esmag * i.numeroParafusos, bordaMin = 1.75 * i.diametroMM;
  return { entrada: i, resultados: { areaParafusoCM2: ab, resistenciaCorteKN: corte, resistenciaEsmagamentoKN: esmagTotal, distanciaBordaMinimaMM: bordaMin }, verificacoes: { corte: status(i.forcaKN <= corte, 'OK', 'AUMENTAR PARAFUSOS'), esmagamento: status(i.forcaKN <= esmagTotal, 'OK', 'AUMENTAR CHAPA'), borda: status(i.distanciaBordaMM >= bordaMin, 'OK', 'AUMENTAR BORDA') }, metadados: meta('Planilha_Ligacao_Parafusada_NBR8800.xlsx', 'NBR 8800:2008') };
}

export function calcularOrcamentoCronograma(values = {}) {
  const etapas = values.etapas || [{ nome: 'Fundações', valor: 60000, inicio: 1, fim: 2 }, { nome: 'Estrutura', valor: 150000, inicio: 2, fim: 5 }];
  const mensal = Array(12).fill(0); etapas.forEach((e) => { const meses = Math.max(1, Number(e.fim) - Number(e.inicio) + 1); for (let m = Number(e.inicio); m <= Number(e.fim); m += 1) if (m >= 1 && m <= 12) mensal[m - 1] += Number(e.valor || 0) / meses; });
  const total = etapas.reduce((s, e) => s + Number(e.valor || 0), 0); let acumulado = 0; const curvaS = mensal.map((v) => { acumulado += v; return total ? acumulado / total : 0; });
  return { entrada: { etapas }, resultados: { totalObra: total, mensal, percentualMensal: mensal.map((v) => total ? v / total : 0), curvaS }, verificacoes: { periodos: status(etapas.every((e) => e.inicio >= 1 && e.fim <= 12 && e.fim >= e.inicio), 'OK', 'PERÍODO INVÁLIDO') }, metadados: meta('Planilha_Orcamento_Cronograma.xlsx', 'Curva S simplificada') };
}

export function calcularPilarMetalico(values = {}) {
  const i = { cargaKN: n(values.cargaKN, 400), comprimentoM: n(values.comprimentoM, 3.5), k: n(values.k, 1), areaCM2: n(values.areaCM2, 40), raioGiroCM: n(values.raioGiroCM, 4.5), fyMPa: n(values.fyMPa, 345) };
  const lambda = i.k * i.comprimentoM * 100 / i.raioGiroCM, e = 200000, ne = Math.PI ** 2 * e * i.areaCM2 / lambda ** 2 / 10, lambda0 = Math.sqrt(i.areaCM2 * i.fyMPa / 10 / ne), chi = lambda0 <= 1.5 ? .658 ** lambda0 ** 2 : .877 / lambda0 ** 2, nrd = chi * i.areaCM2 * i.fyMPa / 11;
  return { entrada: i, resultados: { comprimentoFlambagemM: i.k * i.comprimentoM, lambda, cargaEulerKN: ne, lambda0, chi, resistenciaKN: nrd, cargaCalculoKN: 1.4 * i.cargaKN, taxaUtilizacao: 1.4 * i.cargaKN / nrd }, verificacoes: { esbeltez: status(lambda <= 200, 'OK', 'EXCESSIVA'), resistencia: status(1.4 * i.cargaKN <= nrd, 'OK', 'SEÇÃO INSUFICIENTE') }, metadados: meta('Planilha_Pilar_Metalico_NBR8800.xlsx', 'NBR 8800:2008') };
}

export function calcularRedeEsgoto(values = {}) {
  const i = { populacao: n(values.populacao, 500), consumoLHabDia: n(values.consumoLHabDia, 150), coefRetorno: n(values.coefRetorno, .8), k1: n(values.k1, 1.2), k2: n(values.k2, 1.5), diametroMM: n(values.diametroMM, 150), declividade: n(values.declividade, .005), manningN: n(values.manningN, .013) };
  const qmed = i.populacao * i.consumoLHabDia * i.coefRetorno / 86400, qf = i.k1 * i.k2 * qmed, qd = Math.max(qf, 1.5), imin = .0055 * qd ** (-.47), theta = 2 * Math.acos(1 - 2 * .75), area = (i.diametroMM / 1000) ** 2 / 8 * (theta - Math.sin(theta)), perimetro = i.diametroMM / 1000 * theta / 2, raio = area / perimetro, qcap = 1 / i.manningN * area * raio ** (2 / 3) * Math.sqrt(i.declividade) * 1000, velocidade = qcap / 1000 / area;
  return { entrada: i, resultados: { vazaoMediaLS: qmed, vazaoMaximaLS: qf, vazaoDimensionamentoLS: qd, declividadeMinima: imin, capacidadeLS: qcap, velocidadeMS: velocidade }, verificacoes: { declividade: status(i.declividade >= imin, 'OK', 'AUMENTAR DECLIVIDADE'), capacidade: status(qd <= qcap, 'OK', 'AUMENTAR DIÂMETRO'), autolimpeza: status(velocidade >= .6, 'OK', 'VELOCIDADE BAIXA'), erosao: status(velocidade <= 5, 'OK', 'VELOCIDADE ALTA'), diametro: status(i.diametroMM >= 100, 'OK', 'DIÂMETRO ABAIXO DO MÍNIMO') }, metadados: meta('Planilha_Rede_Esgoto_NBR9649.xlsx', 'NBR 9649:1986') };
}

export function calcularReservatorio(values = {}) {
  const i = { populacao: n(values.populacao, 20), consumoLHabDia: n(values.consumoLHabDia, 200), diasReserva: n(values.diasReserva, 1), reservaIncendioL: n(values.reservaIncendioL, 0), alturaAguaM: n(values.alturaAguaM, 1.5), espessuraParedeCM: n(values.espessuraParedeCM, 15), cobrimentoCM: n(values.cobrimentoCM, 3), fckMPa: n(values.fckMPa, 25), fykMPa: n(values.fykMPa, 500) };
  const consumo = i.populacao * i.consumoLHabDia, vd = consumo * i.diasReserva, total = vd + i.reservaIncendioL, empuxo = .5 * 10 * i.alturaAguaM ** 2, md = 1.4 * empuxo * i.alturaAguaM / 3, d = i.espessuraParedeCM - i.cobrimentoCM, fcd = i.fckMPa / 14, fyd = i.fykMPa / 11.5, kmd = md * 100 / (100 * d ** 2 * fcd), disc = .4624 - 1.088 * kmd, xi = disc < 0 ? null : (.68 - Math.sqrt(disc)) / .544, z = xi == null ? null : d - .4 * xi * d, as = z == null ? null : md * 100 / (fyd * z), asMin = .0015 * 100 * i.espessuraParedeCM;
  return { entrada: i, resultados: { consumoDiarioL: consumo, volumeDomesticoL: vd, volumeTotalL: total, volumeTotalM3: total / 1000, empuxoKNM: empuxo, momentoKNMM: md, asCalcCM2M: as, asMinCM2M: asMin, asAdotadaCM2M: as == null ? null : Math.max(as, asMin) }, verificacoes: { parede: xi == null ? 'AUMENTAR ESPESSURA' : 'OK' }, metadados: meta('Planilha_Reservatorio.xlsx', 'NBR 5626:2020 / NBR 6118:2014') };
}

export function calcularSarjetaBocaLobo(values = {}) {
  const i = { vazaoLS: n(values.vazaoLS, 80), declividadeLongitudinalPct: n(values.declividadeLongitudinalPct, 1), declividadeTransversalPct: n(values.declividadeTransversalPct, 3), larguraEspraiamentoM: n(values.larguraEspraiamentoM, 2), manningN: n(values.manningN, .016), comprimentoBocaM: n(values.comprimentoBocaM, 1) };
  const sx = i.declividadeTransversalPct / 100, y = i.larguraEspraiamentoM * sx, area = .5 * i.larguraEspraiamentoM * y, p = i.larguraEspraiamentoM * Math.sqrt(1 + sx ** 2), r = area / p, qcap = 1 / i.manningN * area * r ** (2 / 3) * Math.sqrt(i.declividadeLongitudinalPct / 100) * 1000, qb = 1.7 * i.comprimentoBocaM * y ** 1.5 * 1000;
  return { entrada: i, resultados: { laminaM: y, areaMolhadaM2: area, capacidadeSarjetaLS: qcap, capacidadeBocaLS: qb, eficienciaCaptacao: Math.min(qb / i.vazaoLS, 1) }, verificacoes: { sarjeta: status(i.vazaoLS <= qcap, 'OK', 'AUMENTAR CAPACIDADE'), boca: status(qb >= i.vazaoLS, 'OK', 'CAPTAÇÃO PARCIAL') }, metadados: meta('Planilha_Sarjeta_Boca_Lobo.xlsx', 'Microdrenagem urbana') };
}

export function calcularTubulacaoAguaFria(values = {}) {
  const i = { vazaoLS: n(values.vazaoLS, .3), diametroMM: n(values.diametroMM, 25), comprimentoRealM: n(values.comprimentoRealM, 8), comprimentoEquivalenteM: n(values.comprimentoEquivalenteM, 3), material: values.material || 'PVC' };
  const total = i.comprimentoRealM + i.comprimentoEquivalenteM, j = 8.69e5 * i.vazaoLS ** 1.75 * i.diametroMM ** (-4.75), perda = j * total, area = Math.PI * (i.diametroMM / 1000) ** 2 / 4, velocidade = i.vazaoLS / 1000 / area;
  return { entrada: i, resultados: { comprimentoTotalM: total, perdaUnitáriaMcaM: j, perdaTotalMca: perda, areaM2: area, velocidadeMS: velocidade }, verificacoes: { velocidadeMax: status(velocidade <= 3, 'OK', 'VELOCIDADE ALTA'), velocidadeMin: status(velocidade >= .6, 'OK', 'VELOCIDADE BAIXA') }, metadados: meta('Planilha_Tubulacao_Agua_Fria_NBR5626.xlsx', 'NBR 5626:2020') };
}

export function calcularVigaMetalica(values = {}) {
  const i = { vaoM: n(values.vaoM, 6), cargaPermanenteKNM: n(values.cargaPermanenteKNM, 5), cargaAcidentalKNM: n(values.cargaAcidentalKNM, 4), comprimentoDestravadoM: n(values.comprimentoDestravadoM, 6), limiteFlecha: n(values.limiteFlecha, 350), alturaPerfilMM: n(values.alturaPerfilMM, 200), larguraMesaMM: n(values.larguraMesaMM, 200), espessuraMesaMM: n(values.espessuraMesaMM, 10), espessuraAlmaMM: n(values.espessuraAlmaMM, 6), areaCM2: n(values.areaCM2, 46.5), inerciaCM4: n(values.inerciaCM4, 4200), moduloResistenteCM3: n(values.moduloResistenteCM3, 420), moduloPlasticoCM3: n(values.moduloPlasticoCM3, 470), raioGiroYCM: n(values.raioGiroYCM, 5), fyMPa: n(values.fyMPa, 345) };
  const pd = 1.4 * (i.cargaPermanenteKNM + i.cargaAcidentalKNM), md = pd * i.vaoM ** 2 / 8, vd = pd * i.vaoM / 2, e = 200000, lambdaMesa = i.larguraMesaMM / 2 / i.espessuraMesaMM, lambdaPMesa = .38 * Math.sqrt(e / i.fyMPa), lambdaAlma = i.alturaPerfilMM / i.espessuraAlmaMM, lambdaPAlma = 3.76 * Math.sqrt(e / i.fyMPa), mpl = i.moduloPlasticoCM3 * i.fyMPa / 100, lp = 1.76 * i.raioGiroYCM * Math.sqrt(e / i.fyMPa) / 100, mrd = mpl / 1.1, vpl = .6 * i.fyMPa * (i.alturaPerfilMM / 10) * (i.espessuraAlmaMM / 10) / 100, vrd = vpl / 1.1, flecha = 5 * ((i.cargaPermanenteKNM + i.cargaAcidentalKNM) / 100) * (i.vaoM * 100) ** 4 / (384 * e / 10 * i.inerciaCM4), limite = i.vaoM * 100 / i.limiteFlecha;
  return { entrada: i, resultados: { pd, momentoKNM: md, cortanteKN: vd, lambdaMesa, lambdaPMesa, lambdaAlma, lambdaPAlma, momentoPlasticoKNM: mpl, lpM: lp, momentoResistenteKNM: mrd, resistenciaCisalhamentoKN: vrd, flechaCM: flecha, flechaLimiteCM: limite }, verificacoes: { mesa: status(lambdaMesa <= lambdaPMesa, 'COMPACTA', 'NÃO COMPACTA'), alma: status(lambdaAlma <= lambdaPAlma, 'COMPACTA', 'NÃO COMPACTA'), flexao: status(md <= mrd, 'OK', 'SEÇÃO INSUFICIENTE'), cisalhamento: status(vd <= vrd, 'OK', 'SEÇÃO INSUFICIENTE'), flecha: status(flecha <= limite, 'OK', 'FLECHA EXCESSIVA') }, metadados: meta('Planilha_Viga_Metalica_NBR8800.xlsx', 'NBR 8800:2008') };
}
