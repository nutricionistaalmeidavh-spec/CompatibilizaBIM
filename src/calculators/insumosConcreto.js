const DEFAULT_INPUTS = Object.freeze({
  volumeM3: 6,
  tracoAreia: 4.08,
  tracoBrita: 2.96,
  relacaoAguaCimento: 0.7,
  massaEspecificaCimento: 3,
  massaEspecificaAreia: 2.62,
  massaEspecificaBrita: 2.75,
  massaEspecificaAgua: 1,
});

export class InsumosInputValidationError extends Error {
  constructor(errors) {
    super(`Entradas inválidas: ${errors.join('; ')}`);
    this.name = 'InsumosInputValidationError';
    this.errors = errors;
  }
}

function validate(input) {
  const errors = [];
  const positiveFields = [
    ['volumeM3', input.volumeM3],
    ['tracoAreia', input.tracoAreia],
    ['tracoBrita', input.tracoBrita],
    ['relacaoAguaCimento', input.relacaoAguaCimento],
    ['massaEspecificaCimento', input.massaEspecificaCimento],
    ['massaEspecificaAreia', input.massaEspecificaAreia],
    ['massaEspecificaBrita', input.massaEspecificaBrita],
    ['massaEspecificaAgua', input.massaEspecificaAgua],
  ];
  for (const [name, value] of positiveFields) {
    if (!Number.isFinite(value) || value <= 0) errors.push(`${name} deve ser maior que zero`);
  }
  if (errors.length) throw new InsumosInputValidationError(errors);
}

/**
 * Reproduz a Planilha_Insumos_Concreto.xlsx pelo método da massa unitária.
 * As massas específicas são informadas em kg/dm³; o volume em m³.
 */
export function calcularInsumosConcreto(values = {}) {
  const input = { ...DEFAULT_INPUTS, ...values };
  validate(input);
  const {
    volumeM3: volume,
    tracoAreia: areia,
    tracoBrita: brita,
    relacaoAguaCimento: aguaCimento,
    massaEspecificaCimento: rhoCimento,
    massaEspecificaAreia: rhoAreia,
    massaEspecificaBrita: rhoBrita,
    massaEspecificaAgua: rhoAgua,
  } = input;

  const somaVolumesAbsolutos = 1 / rhoCimento + areia / rhoAreia + brita / rhoBrita + aguaCimento / rhoAgua;
  const cimentoKgPorM3 = 1000 / somaVolumesAbsolutos;
  const cimentoTotalKg = cimentoKgPorM3 * volume;
  const areiaTotalKg = cimentoKgPorM3 * areia * volume;
  const britaTotalKg = cimentoKgPorM3 * brita * volume;
  const aguaTotalLitros = cimentoKgPorM3 * aguaCimento * volume;

  return {
    entrada: input,
    resultados: {
      somaVolumesAbsolutos,
      cimentoKgPorM3,
      cimentoTotalKg,
      areiaTotalKg,
      britaTotalKg,
      aguaTotalLitros,
      cimentoSacos50Kg: Math.ceil(cimentoTotalKg / 50),
      areiaTotalM3Estimado: areiaTotalKg / 1450,
      britaTotalM3Estimado: britaTotalKg / 1400,
    },
    metadados: {
      referencia: 'Planilha_Insumos_Concreto.xlsx',
      metodo: 'Método da massa unitária',
      observacao: 'Estimativa de insumos. Para concreto estrutural, validar dosagem e resistência em laboratório.',
    },
  };
}

export { DEFAULT_INPUTS };
