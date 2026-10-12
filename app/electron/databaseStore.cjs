'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'binary');
function validateSqlite(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 100 || !bytes.subarray(0, 16).equals(SQLITE_HEADER)) {
    throw new Error('Arquivo SQLite inválido: cabeçalho ou tamanho incorreto.');
  }
  return bytes;
}
function decodeSqlite(base64) {
  if (typeof base64 !== 'string' || base64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error('Conteúdo SQLite em base64 inválido.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.toString('base64') !== base64) throw new Error('Conteúdo SQLite em base64 inválido.');
  return validateSqlite(bytes);
}
function readSqliteFile(file) { return validateSqlite(fs.readFileSync(file)); }
function readSqliteSnapshot(file) { return readSqliteFile(file + '.previous'); }

function writeDurable(file, bytes) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function atomicSaveSqlite(file, base64, { beforeReplace } = {}) {
  const bytes = decodeSqlite(base64);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const suffix = '.' + process.pid + '-' + randomBytes(6).toString('hex') + '.tmp';
  const tmp = file + suffix;
  const snapshotTemp = file + '.previous' + suffix;
  try {
    writeDurable(tmp, bytes);
    if (fs.existsSync(file)) {
      // Preserve the last intact state before replacing; the previous snapshot
      // itself is atomically replaced so an interruption cannot corrupt both.
      const previous = readSqliteFile(file);
      writeDurable(snapshotTemp, previous);
      fs.renameSync(snapshotTemp, file + '.previous');
    }
    if (beforeReplace) beforeReplace();
    fs.renameSync(tmp, file);
    return { bytes: bytes.length, previousSnapshot: fs.existsSync(file + '.previous') };
  } finally {
    for (const candidate of [tmp, snapshotTemp]) {
      try { if (fs.existsSync(candidate)) fs.unlinkSync(candidate); } catch {}
    }
  }
}
function restoreSqliteFile(file, base64, options) {
  return atomicSaveSqlite(file, base64, options);
}
module.exports = { validateSqlite, decodeSqlite, readSqliteFile, readSqliteSnapshot, atomicSaveSqlite, restoreSqliteFile };
