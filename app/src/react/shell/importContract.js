// File checks run before storing bytes in SQLite, never treat filename or a
// partial preview hash as authoritative content identity.
export const MAX_LOCAL_MODEL_BYTES=64*1024*1024;
export function modelFormat(name) {
 const n=String(name||'').trim().toLowerCase();
 if(n.endsWith('.dwg'))return 'dwg';
 if(n.endsWith('.dxf'))return 'dxf';
 if(n.endsWith('.ifc'))return 'ifc';
 if(n.endsWith('.cbim.json')||n.endsWith('.json'))return 'json';
 return null;
}
export function checkImportFile(file) {
 if(!file||!file.name)throw new Error('Selecione um modelo BIM ou CAD.');
 const format=modelFormat(file.name);
 if(!format)throw new Error('Formato não suportado: use DWG, DXF, IFC ou JSON CBIM.');
 if(!Number.isFinite(file.size)||file.size<=0)throw new Error('O arquivo está vazio ou não pode ser lido.');
 if(file.size>MAX_LOCAL_MODEL_BYTES)throw new Error('Arquivo maior que 64 MiB: use uma divisão por disciplina/pavimento; o original foi preservado fora do banco.');
 return format;
}
export function readCbimElements(text) {
 let parsed;
 try {parsed=JSON.parse(text);} catch {throw new Error('JSON do modelo não é válido.');}
 const elements=parsed?.elements??parsed?.elementos;
 if(!Array.isArray(elements))throw new Error('JSON não possui a lista de elementos CBIM esperada; nenhum modelo foi importado.');
 if(parsed?.schema&&parsed.schema!=='CBIM')throw new Error('Schema CBIM não reconhecido.');
 if(parsed?.schema_version&&parsed.schema_version!=='0.2.0')throw new Error('Versão do schema CBIM ainda não suportada: '+parsed.schema_version);
 return elements;
}
export function contentFingerprint(bytes) {
 // Full-content deterministic fingerprint; NOT cryptographic, used only for
 // local duplicate hints. Security hashes for release artifacts use SHA-256.
 const values=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 let a=2166136261,b=2166136261;
 for(let i=0;i<values.length;i++){a=Math.imul(a^values[i],16777619);b=Math.imul(b^(values[i]+i%251),16777619);}
 return 'fnv32x2:'+[(a>>>0).toString(16).padStart(8,'0'),(b>>>0).toString(16).padStart(8,'0')].join('')+':'+values.length;
}


// Cryptographic model identity for all NEW local imports. Historical FNV32x2
// fingerprints remain readable; do not rewrite revision/audit snapshots.
export async function sha256Identity(bytes) {
 const source=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(!globalThis.crypto?.subtle)throw Error('SHA-256 indisponível; importação bloqueada para preservar a identidade do modelo.');
 const result=await globalThis.crypto.subtle.digest('SHA-256',source);
 return 'sha256:'+Array.from(new Uint8Array(result),byte=>byte.toString(16).padStart(2,'0')).join('');
}
