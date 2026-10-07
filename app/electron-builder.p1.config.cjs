'use strict';
// Build-time only: include an issuer PUBLIC key when explicitly supplied locally.
// Never scan/copy folders of private issuer keys or customer license files.
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('./package.json');
const publicKey = path.resolve(__dirname, '..', 'license', 'public.pem');
const resources = [...pkg.build.extraResources];
if (fs.existsSync(publicKey)) {
  const firstLine = fs.readFileSync(publicKey, 'utf8').split(/\r?\n/,1)[0];
  if (firstLine !== '-----BEGIN PUBLIC KEY-----') {
    throw new Error('Chave pública inválida para empacotamento CBIM P1.');
  }
  resources.push({ from: '../license/public.pem', to: 'license/public.pem' });
}
module.exports = {
  ...pkg.build,
  extraResources: resources
};
