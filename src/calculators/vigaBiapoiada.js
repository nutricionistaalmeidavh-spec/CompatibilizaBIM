const DEFAULT_INPUTS = Object.freeze({
  vaoM: 5,
  cargaPermanenteKNM: 12,
  cargaAcidentalKNM: 8,
  larguraCM: 20,
  alturaCM: 50,
  cobrimentoCM: 4,
  apoioDisponivelCM: 20,
  fckMPa: 25,
  fykMPa: 500,
  fywkMPa: 600,
  bitolaLongitudinalMM: 12.5,
  bitolaEstriboMM: 6.3,
  ramosEstribo: 2,
  limiteFlechaDivisor: 250,
});

export class InputValidationError extends Error {
  constructor(errors) {
    super(`Entradas inválidas: ${errors.join('; ')}`);
    this.name = 'InputValidationError';
    this.errors = errors;
  }
}

function positive(name, value, errors, { allowZero = false } = {}) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    errors.push(`${name} deve ser ${allowZero ? 'maior ou igual a zero' : 'maior que zero'}`);
  }
}

function validate(input) {
  const errors = [];
  positive('vaoM', input.vaoM, errors);
  positive('cargaPermanenteKNM', input.cargaPermanenteKNM, errors, { allowZero: true });
  positive('cargaAcidentalKNM', input.cargaAcidentalKNM, errors, { allowZero: true });
  positive('larguraCM', input.larguraCM, errors);
  positive('alturaCM', input.alturaCM, errors);
  positive('cobrimentoCM', input.cobrimentoCM, errors, { allowZero: true });
  positive('apoioDisponivelCM', input.apoioDisponivelCM, errors);
  positive('fckMPa', input.fckMPa, errors);
  positive('fykMPa', input.fykMPa, errors);
  positive('fywkMPa', input.fywkMPa, errors);
  positive('bitolaLongitudinalMM', input.bitolaLongitudinalMM, errors);
  positive('bitolaEstriboMM', input.bitolaEstriboMM, errors);
  positive('ramosEstribo', input.ramosEstribo, errors);
  positive('limiteFlechaDivisor', input.limiteFlechaDivisor, errors);

  if (input.alturaCM <= input.cobrimentoCM) errors.push('alturaCM deve ser maior que cobrimentoCM');
  if (input.bitolaEstriboMM > input.larguraCM * 10 / 10) errors.push('bitolaEstriboMM não pode exceder a largura da viga');
  if (!Number.isInteger(input.ramosEstribo)) errors.push('ramosEstribo deve ser inteiro');
  if (errors.length) throw new InputValidationError(errors);
}

function minimumSteelRatio(fckMPa) {
  if (fckMPa <= 25) return 0.0015;
  if (fckMPa <= 30) return 0.00173;
  if (fckMPa <= 35) return 0.00201;
  if (fckMPa <= 40) return 0.0023;
  if (fckMPa <= 45) return 0.00259;
  return 0.00288;
}

function status(ok, success, failure) {
  return { ok, texto: ok ? success : failure };
}

/**
 * Calcula uma viga biapoiada de seção retangular seguindo a estrutura da
 * planilha de referência Planilha_Viga_Biapoiada_Completa.xlsx.
 *
 * Unidades de entrada: m, kN/m, cm, MPa e mm conforme o nome de cada campo.
 * O resultado é uma memória de cálculo, não substitui revisão normativa ou ART/RRT.
 */
export function calcularVigaBiapoiada(values = {}) {
  const input = { ...DEFAULT_INPUTS, ...values };
  validate(input);

  const {
    vaoM: L,
    cargaPermanenteKNM: g,
    cargaAcidentalKNM: q,
    larguraCM: b,
    alturaCM: h,
    cobrimentoCM: cobrimento,
    apoioDisponivelCM: apoio,
    fckMPa: fck,
    fykMPa: fyk,
    fywkMPa: fywk,
    bitolaLongitudinalMM: phiL,
    bitolaEstriboMM: phiT,
    ramosEstribo: nr,
    limiteFlechaDivisor: flechaDivisor,
  } = input;

  const pd = 1.4 * (g + q);
  const reacao = pd * L / 2;
  const momento = pd * L ** 2 / 8;
  const cortante = reacao;
  const d = h - cobrimento;
  const cortanteReduzido = pd * (L / 2 - d / 100);

  const fcd = (fck / 10) / 1.4;
  const fyd = (fyk / 10) / 1.15;
  const kmd = (momento * 100) / (b * d ** 2 * fcd);
  const discriminante = 0.4624 - 1.088 * kmd;
  const xi = discriminante < 0 ? null : (0.68 - Math.sqrt(discriminante)) / 0.544;
  const z = xi === null ? null : d - 0.4 * xi * d;
  const asCalc = z === null ? null : (momento * 100) / (fyd * z);
  const rhoMin = minimumSteelRatio(fck);
  const asMin = rhoMin * b * h;
  const asMax = 0.04 * b * h;
  const asAdotada = asCalc === null ? null : Math.max(asCalc, asMin);
  const areaBarra = Math.PI * (phiL / 10) ** 2 / 4;
  const numeroBarras = asAdotada === null ? null : Math.ceil(asAdotada / areaBarra);

  const alphaV2 = 1 - fck / 250;
  const vrd2 = 0.27 * alphaV2 * fcd * b * d;
  const fctm = 0.3 * fck ** (2 / 3);
  const fctd = 0.7 * fctm / 1.4;
  const vc = 0.6 * (fctd / 10) * b * d;
  const vsw = Math.max(cortanteReduzido - vc, 0);
  const fywd = (fywk / 10) / 1.15;
  const aswCalc = vsw / (0.9 * d * fywd);
  const rhoSwMin = 0.2 * fctm / fywk;
  const aswMin = rhoSwMin * b;
  const aswAdotada = Math.max(aswCalc, aswMin);
  const areaEstribo = nr * Math.PI * (phiT / 10) ** 2 / 4;
  const espacamentoCalculado = areaEstribo / aswAdotada;
  const espacamentoMaximo = cortante <= 0.67 * vrd2 ? Math.min(0.6 * d, 30) : Math.min(0.3 * d, 20);
  const espacamentoAdotado = Math.min(espacamentoCalculado, espacamentoMaximo);

  const fbd = 2.25 * fctd;
  const lb = (phiL / 10 / 4) * ((fyd * 10) / fbd);
  const lbMin = Math.max(0.3 * lb, 10 * phiL / 10, 10);
  const lbNec = Math.max(lb * asCalc / asAdotada, lbMin);

  const ecs = 5600 * Math.sqrt(fck);
  const es = 210000;
  const alphaE = es / ecs;
  const ic = b * h ** 3 / 12;
  const mr = 1.5 * (fctm / 10) * (b * h ** 2 / 6) / 100;
  const ma = (g + q) * L ** 2 / 8;
  const xII = (-alphaE * asAdotada + Math.sqrt((alphaE * asAdotada) ** 2 + 2 * b * alphaE * asAdotada * d)) / b;
  const iII = b * xII ** 3 / 3 + alphaE * asAdotada * (d - xII) ** 2;
  const razaoFissura = ma === 0 ? 1 : Math.min((mr / ma) ** 3, 1);
  const ieq = razaoFissura * ic + (1 - razaoFissura) * iII;
  const flechaImediata = 5 * ((g + q) / 100) * (L * 100) ** 4 / (384 * (ecs / 10) * ieq);
  const coefFluencia = 2;
  const flechaTotal = flechaImediata * (1 + coefFluencia);
  const flechaLimite = (L * 100) / flechaDivisor;

  const resultado = {
    entrada: input,
    esforcos: { pd, reacao, momento, cortante, d, cortanteReduzido },
    flexao: {
      fcd, fyd, kmd, xi, z, asCalc, rhoMin, asMin, asMax, asAdotada, areaBarra, numeroBarras,
      verificacaoDuctilidade: status(xi !== null && xi <= 0.45, 'OK', xi === null ? 'REDIMENSIONAR SEÇÃO' : 'ARMADURA DUPLA'),
      verificacaoAsMax: status(asAdotada !== null && asAdotada <= asMax, 'OK', 'SEÇÃO INSUFICIENTE'),
    },
    cisalhamento: {
      alphaV2, vrd2, fctm, fctd, vc, vsw, fywd, aswCalc, rhoSwMin, aswMin, aswAdotada,
      areaEstribo, espacamentoCalculado, espacamentoMaximo, espacamentoAdotado,
      verificacaoBiela: status(cortante <= vrd2, 'OK', 'AUMENTE A SEÇÃO (esmagamento da biela)'),
      verificacaoBitolaEstribo: status(phiT >= 5 && phiT <= b, 'OK', 'AJUSTE A BITOLA DO ESTRIBO'),
      governante: espacamentoCalculado <= espacamentoMaximo ? 'Vsw calculado (cisalhamento)' : 'Asw,mín / s,máx normativo — situação normal',
    },
    ancoragem: {
      fbd, lb, lbMin, lbNec,
      verificacaoApoio: status(lbNec <= apoio, 'OK', 'INSUFICIENTE — use gancho ou grampos adicionais'),
    },
    flecha: {
      ecs, es, alphaE, ic, mr, ma, xII, iII, ieq, flechaImediata, coefFluencia, flechaTotal, flechaLimite,
      verificacao: status(flechaTotal <= flechaLimite, 'OK', 'FLECHA EXCESSIVA — AUMENTE h'),
    },
    verificacoesGerais: {
      relacaoVaoLargura: (L * 100) / b,
      relacaoAlturaLargura: h / b,
      estabilidadeLateral: status((L * 100) / b <= 50 && h / b <= 5, 'OK — não precisa considerar 2ª ordem lateral', 'VERIFICAR INSTABILIDADE LATERAL EM DETALHE'),
      larguraMinima: status(b >= 12, 'OK', 'b ABAIXO DO MÍNIMO NORMATIVO'),
    },
    metadados: {
      referencia: 'Planilha_Viga_Biapoiada_Completa.xlsx',
      normaDeclarada: 'NBR 6118:2014',
      observacao: 'Memória de cálculo para validação de software; não substitui revisão normativa nem responsabilidade técnica.',
    },
  };

  return resultado;
}

export { DEFAULT_INPUTS };
