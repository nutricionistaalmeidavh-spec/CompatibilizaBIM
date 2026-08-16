export function exportarDetalhamentoJson(resultado, contexto = {}) { return JSON.stringify({ tipo: 'detalhamento-preliminar', contexto, resultado, geradoEm: new Date().toISOString() }, null, 2); }

export function exportarDetalhamentoCsv(resultado = {}) {
  const rows = [['item', 'valor'], ...Object.entries(resultado).map(([key, value]) => [key, value])];
  return rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
}

/**
 * Exporta uma representação CAD 2D neutra (DXF R12) para conferência e
 * importação em ferramentas CAD. O arquivo é deliberadamente simples:
 * contém uma tabela textual e um retângulo de referência, sem se passar por
 * desenho executivo. Isso torna o exportador determinístico e offline.
 */
export function exportarDetalhamentoDxf(resultado = {}, contexto = {}) {
  const entries = Object.entries(resultado).flatMap(([key, value]) => {
    if (value && typeof value === 'object') return Object.entries(value).map(([child, item]) => [`${key}.${child}`, item]);
    return [[key, value]];
  });
  const esc = (value) => String(value ?? '-').replace(/[\r\n]/g, ' ').slice(0, 120);
  const lines = ['0', 'SECTION', '2', 'ENTITIES'];
  const addText = (text, x, y, height = 2.5) => lines.push('0', 'TEXT', '8', 'DETALHAMENTO', '10', String(x), '20', String(y), '30', '0', '40', String(height), '1', esc(text));
  addText(`ENGENHARIA 360 - ${contexto.titulo ?? 'DETALHAMENTO'}`, 10, 285, 4);
  addText(`Gerado em ${contexto.geradoEm ?? new Date().toISOString()}`, 10, 278, 2);
  let y = 268;
  for (const [key, value] of entries) {
    if (y < 12) break;
    addText(`${key}: ${value}`, 12, y);
    y -= 6;
  }
  lines.push('0', 'LINE', '8', 'REFERENCIA', '10', '10', '20', '10', '30', '0', '11', '200', '21', '10', '31', '0');
  lines.push('0', 'LINE', '8', 'REFERENCIA', '10', '200', '20', '10', '30', '0', '11', '200', '21', '270', '31', '0');
  lines.push('0', 'LINE', '8', 'REFERENCIA', '10', '200', '20', '270', '30', '0', '11', '10', '21', '270', '31', '0');
  lines.push('0', 'LINE', '8', 'REFERENCIA', '10', '10', '20', '270', '30', '0', '11', '10', '21', '10', '31', '0');
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n') + '\n';
}
