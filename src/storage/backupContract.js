// Version-one exports remain readable: integrity fields are additive.
export function calcularChecksumCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
export function decodificarBackupSqlite(base64) {
  if (typeof base64 !== 'string' || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error('Backup SQLite em base64 inválido.');
  }
  let raw;
  try { raw = atob(base64); } catch { throw new Error('Backup SQLite em base64 inválido.'); }
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  if (bytes.length < 100 || Array.from(bytes.subarray(0,16)).map(x=>String.fromCharCode(x)).join('') !== 'SQLite format 3\0') {
    throw new Error('O backup não contém um banco SQLite válido.');
  }
  return bytes;
}
export function validarContratoBackup(texto) {
  let dados;
  try { dados = typeof texto === 'string' ? JSON.parse(texto) : texto; }
  catch { return { valido: false, erros: ['JSON de backup inválido.'] }; }
  const erros = [];
  if (dados?.versao !== 1) erros.push('Versão de backup não suportada.');
  let bytes;
  try { bytes = decodificarBackupSqlite(dados?.bancoBase64); }
  catch (e) { erros.push(e.message); }
  if (bytes) {
    if (dados.tamanhoBytes !== undefined && dados.tamanhoBytes !== bytes.length) erros.push('Tamanho do backup diverge do conteúdo.');
    if (dados.checksumCrc32 !== undefined && dados.checksumCrc32 !== calcularChecksumCrc32(bytes)) {
      erros.push('Checksum do backup não corresponde ao conteúdo.');
    }
  }
  return { valido: erros.length === 0, erros, versao: dados?.versao ?? null,
    exportadoEm: dados?.exportadoEm ?? null, bytes: erros.length ? null : bytes };
}
