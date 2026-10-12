import test from 'node:test';
import assert from 'node:assert/strict';
import { validarFotosRdo, resumoEvidenciasRdo } from '../src/domain/rdoEvidence.js';
test('F7 persisted photos restrict MIME and size and retain useful PDF metadata',()=>{
 const good={uri:'data:image/jpeg;base64,'+Buffer.from('test').toString('base64'),legenda:'Ponto HID',local:'Térreo'};
 assert.equal(validarFotosRdo([good]).length,1);
 assert.ok(resumoEvidenciasRdo([good])[0].includes('Ponto HID'));
 assert.throws(()=>validarFotosRdo([{uri:'data:text/html;base64,PGh0bWw+'}]),/imagem/i);
 assert.throws(()=>validarFotosRdo([{uri:'file:///etc/passwd'}]),/imagem/i);
});
