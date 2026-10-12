import test from 'node:test';
import assert from 'node:assert/strict';
import {gerarPdfRelatorio} from '../app/src/pdfTemplates.js';
test('F7 RDO photo annex embeds binary JPEG as a visible PDF image page',async()=>{
 const bytes=Uint8Array.from([0xff,0xd8,0xff,0xd9]); // stream marker fixture; renderer supplies a real JPEG
 const pdf=gerarPdfRelatorio('RDO com evidências',{Obra:['Teste']},[{jpeg:bytes,width:20,height:20,caption:'Frente de serviço'}]);
 const text=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
 assert.match(text,/\/Subtype \/Image/);
 assert.match(text,/\/Filter \/DCTDecode/);
 assert.match(text,/\/Count 2/);
 assert.match(text,/\/Im1 Do/);
 assert.match(text,/Frente de servico/);
});
test('F7 invalid photo bytes cannot masquerade as a valid annex',()=>{
 assert.throws(()=>gerarPdfRelatorio('RDO',{},[{jpeg:new Uint8Array([1,2,3]),width:1,height:1}]),/JPEG inválido/);
});
