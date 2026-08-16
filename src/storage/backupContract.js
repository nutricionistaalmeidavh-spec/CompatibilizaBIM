export function validarContratoBackup(texto) {
  let dados; try { dados = typeof texto === 'string' ? JSON.parse(texto) : texto; } catch { return { valido: false, erros: ['JSON de backup inválido.'] }; }
  const erros = []; if (dados?.versao !== 1) erros.push('Versão de backup não suportada.'); if (typeof dados?.bancoBase64 !== 'string' || dados.bancoBase64.length < 8) erros.push('Banco SQLite ausente ou corrompido.'); return { valido: erros.length === 0, erros, versao: dados?.versao ?? null, exportadoEm: dados?.exportadoEm ?? null };
}
