'use strict';
// Studio IFC bridge: immutable source, same canonical CBIM element IDs, no network or paid runtime.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {resolveCbimWorkspace} = require('./studioWindow.cjs');

const IFC64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
const URL_NAMESPACE = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');

function cbimIfcGuid(elementId) {
  if (typeof elementId !== 'string' || !elementId || elementId.length > 512) {
    throw new Error('Identificador CBIM inválido');
  }
  const bytes = createHash('sha1').update(URL_NAMESPACE).update(Buffer.from(elementId, 'utf8')).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  let value = BigInt('0x' + bytes.toString('hex'));
  const characters = [];
  for (let i = 0; i < 22; i++) {
    characters.push(IFC64[Number(value % 64n)]);
    value /= 64n;
  }
  return characters.reverse().join('');
}

function resolveStudioIfcSource(documentsDir, workspacePath) {
  const workspace = resolveCbimWorkspace(documentsDir, workspacePath);
  const job = path.dirname(workspace);
  const available = fs.readdirSync(job, {withFileTypes: true})
    .filter(item => item.isFile() && item.name.toLowerCase().endsWith('.ifc'));
  if (available.length === 0) throw new Error('Nenhum IFC exportado neste projeto. Revise a conversão CAD e tente novamente.');
  if (available.length > 1) throw new Error('Este job contém mais de um IFC; a origem do 3D real é ambígua. Revise os arquivos do projeto.');
  const file = available[0];
  const candidate = path.join(job, file.name);
  const real = fs.realpathSync(candidate);
  if (path.dirname(real) !== job) throw new Error('IFC fora do projeto autorizado');
  const stat = fs.statSync(real);
  if (!stat.isFile() || stat.size > 64 * 1024 * 1024 || stat.size < 20) {
    throw new Error('IFC ausente, vazio ou acima do limite local de 64 MiB.');
  }
  const fd = fs.openSync(real, 'r');
  let header;
  try {
    const bytes = Buffer.alloc(Math.min(4096, stat.size));
    fs.readSync(fd, bytes, 0, bytes.length, 0);
    header = bytes.toString('latin1');
  } finally {
    fs.closeSync(fd);
  }
  if (!header.includes('ISO-10303-21')) throw new Error('IFC sem cabeçalho STEP válido.');
  return {path: real, name: file.name};
}

module.exports = {cbimIfcGuid, resolveStudioIfcSource};
