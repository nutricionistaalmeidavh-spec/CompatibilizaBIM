function finite(value, path, errors) {
  if (value !== null && value !== undefined && typeof value === 'number' && !Number.isFinite(value)) errors.push(`${path} não é finito`)
}

function walk(value, path, errors) {
  if (typeof value === 'number') finite(value, path, errors)
  if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walk(item, `${path}.${key}`, errors))
}

export function validarCalculoIndependente(tipo, entrada, resultado) {
  const errors = []
  walk(resultado, 'resultado', errors)
  if (!resultado || typeof resultado !== 'object') errors.push('resultado ausente')
  if (tipo === 'vigaBiapoiada') {
    const esperado = 1.4 * (Number(entrada.cargaPermanenteKNM) + Number(entrada.cargaAcidentalKNM)) * Number(entrada.vaoM) ** 2 / 8
    const obtido = Number(resultado?.esforcos?.momento)
    if (!Number.isFinite(obtido) || Math.abs(obtido - esperado) > 1e-8) errors.push(`momento independente divergente: esperado ${esperado}, obtido ${obtido}`)
  }
  if (tipo === 'insumosConcreto') {
    for (const key of ['cimentoTotalKg', 'areiaTotalKg', 'britaTotalKg', 'aguaTotalLitros']) if (!(Number(resultado?.resultados?.[key]) >= 0)) errors.push(`${key} deve ser não negativo`)
  }
  return { ok: errors.length === 0, errors, metodo: 'oráculo independente + invariantes numéricos', validadoEm: new Date().toISOString() }
}
