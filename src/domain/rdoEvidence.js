const types=new Set(['image/jpeg','image/png','image/webp']);
const maxImageBytes=4*1024*1024,maxTotalBytes=16*1024*1024;
export function validarFotosRdo(fotos=[]){
 if(!Array.isArray(fotos)||fotos.length>12)throw Error('Limite de 12 imagens por RDO.');
 let total=0;
 return fotos.map((f,index)=>{
  const uri=String(f?.uri||'');
  const m=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(uri);
  if(!m||!types.has(m[1])||m[2].length%4!==0)throw Error('Foto '+(index+1)+': selecione imagem JPEG, PNG ou WebP válida.');
  const size=Math.floor(m[2].length*3/4)-(m[2].endsWith('==')?2:m[2].endsWith('=')?1:0);
  if(size<1||size>maxImageBytes)throw Error('Foto maior que 4 MiB ou vazia.');
  total+=size;if(total>maxTotalBytes)throw Error('Total de fotos excede 16 MiB por RDO.');
  return {uri,legenda:String(f.legenda||'').trim().slice(0,180),local:String(f.local||'').trim().slice(0,140)};
 });
}
export function resumoEvidenciasRdo(fotos=[]){
 return validarFotosRdo(fotos).map((foto,index)=>{
  const mime=foto.uri.slice(5,foto.uri.indexOf(';'));
  return 'Foto '+(index+1)+' · '+(foto.legenda||'Sem legenda')+' · '+(foto.local||'Local não informado')+' · '+mime;
 });
}
