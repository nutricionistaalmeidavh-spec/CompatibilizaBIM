// Offline PDF generator using Helvetica and WinAnsi encoding.
const SPECIAL_WIN_ANSI = new Map([
  ['\u20ac', 0x80], ['\u201a', 0x82], ['\u0192', 0x83], ['\u201e', 0x84], ['\u2026', 0x85], ['\u2020', 0x86], ['\u2021', 0x87], ['\u02c6', 0x88], ['\u2030', 0x89], ['\u0160', 0x8a], ['\u2039', 0x8b], ['\u0152', 0x8c], ['\u017d', 0x8e],
  ['\u2018', 0x91], ['\u2019', 0x92], ['\u201c', 0x93], ['\u201d', 0x94], ['\u2022', 0x95], ['\u2013', 0x96], ['\u2014', 0x97], ['\u02dc', 0x98], ['\u2122', 0x99], ['\u0161', 0x9a], ['\u203a', 0x9b], ['\u0153', 0x9c], ['\u017e', 0x9e], ['\u0178', 0x9f],
]);

function winAnsi(value) {
  let out = '';
  for (const char of String(value ?? '')) {
    const code = char.codePointAt(0);
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) out += String.fromCharCode(code);
    else if (SPECIAL_WIN_ANSI.has(char)) out += String.fromCharCode(SPECIAL_WIN_ANSI.get(char));
    else {
      const plain = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      out += plain.length === 1 && plain.charCodeAt(0) <= 0x7f ? plain : '?';
    }
  }
  return out;
}
function escapePdf(value) { return winAnsi(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function wrap(value, max = 92) { const words = String(value ?? '').split(/\s+/); const lines = []; let line = ''; for (const word of words) { if (!line) line = word; else if ((line + ' ' + word).length <= max) line += ` ${word}`; else { lines.push(line); line = word; } } if (line || !lines.length) lines.push(line); return lines; }
function text(x, y, font, size, color, value) { return `BT /${font} ${size} Tf ${color.join(' ')} rg ${x} ${y} Td (${escapePdf(value)}) Tj ET`; }
function line(x1, y1, x2, y2, color = [0.78, 0.86, 0.81], width = 0.7) { return `${color.join(' ')} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`; }
function rect(x, y, width, height, color) { return `${color.join(' ')} rg ${x} ${y} ${width} ${height} re f`; }

function renderPage(title, sections, pageNumber, totalPages) {
  const commands = [rect(0, 770, 595, 72, [0.07, 0.24, 0.17]), text(42, 814, 'F2', 19, [1, 1, 1], 'ENGENHARIA 360'), text(42, 794, 'F1', 9, [0.72, 0.86, 0.78], 'Documento local \u00b7 gerado sem internet'), text(42, 742, 'F2', 15, [0.07, 0.24, 0.17], title), line(42, 730, 553, 730, [0.2, 0.47, 0.33], 1.2)];
  let y = 706;
  for (const [sectionTitle, items] of Object.entries(sections)) {
    commands.push(rect(42, y - 6, 511, 23, [0.91, 0.96, 0.93]), text(52, y + 2, 'F2', 9, [0.10, 0.39, 0.25], String(sectionTitle).toUpperCase())); y -= 29;
    for (const item of Array.isArray(items) ? items : [items]) {
      const value = String(item ?? '-'); const separator = value.indexOf(':'); const pair = separator > 0 && separator < 34 && !value.startsWith('-'); const label = pair ? value.slice(0, separator + 1) : ''; const body = pair ? value.slice(separator + 1).trim() : value.replace(/^[-\u2022]\s*/, ''); const bodyLines = wrap(body, pair ? 70 : 91);
      if (y < 78) break;
      if (pair) { commands.push(text(52, y, 'F2', 9, [0.24, 0.34, 0.28], label), text(180, y, 'F1', 9, [0.12, 0.16, 0.14], bodyLines[0])); for (const extra of bodyLines.slice(1)) { y -= 13; commands.push(text(180, y, 'F1', 9, [0.12, 0.16, 0.14], extra)); } } else { commands.push(text(52, y, 'F1', 9, [0.12, 0.16, 0.14], `\u2022 ${bodyLines[0]}`)); for (const extra of bodyLines.slice(1)) { y -= 13; commands.push(text(64, y, 'F1', 9, [0.12, 0.16, 0.14], extra)); } }
      y -= 16;
    }
    y -= 8;
  }
  commands.push(line(42, 44, 553, 44), text(42, 28, 'F1', 8, [0.42, 0.5, 0.45], 'Engenharia 360 \u00b7 memoria de trabalho; confira a responsabilidade tecnica.'), text(535, 28, 'F1', 8, [0.42, 0.5, 0.45], `${pageNumber}/${totalPages}`)); return commands.join('\n');
}

export function gerarPdfRelatorio(titulo, secoes = {}) {
  const pages = []; let current = {}; let used = 0;
  for (const [section, raw] of Object.entries(secoes)) { const items = Array.isArray(raw) ? raw : [raw]; const weight = 30 + items.reduce((sum, item) => sum + Math.max(1, Math.ceil(String(item ?? '').length / 92)) * 17, 0); if (used && used + weight > 610) { pages.push(current); current = {}; used = 0; } current[section] = items; used += weight; }
  if (Object.keys(current).length) pages.push(current); if (!pages.length) pages.push({ Resumo: ['Nenhum dado informado.'] });
  const contents = pages.map((page, index) => renderPage(titulo, page, index + 1, pages.length)); const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${contents.map((_, index) => `${3 + index * 4} 0 R`).join(' ')}] /Count ${contents.length} >>`];
  contents.forEach((content, index) => { const page = 3 + index * 4; const stream = page + 1; objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${stream + 1} 0 R /F2 ${stream + 2} 0 R >> >> /Contents ${stream} 0 R >>`, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'); });
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offsets = [0]; objects.forEach((object, index) => { offsets[index + 1] = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }); const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([Uint8Array.from(pdf, (char) => char.charCodeAt(0) & 0xff)], { type: 'application/pdf' });
}

/** Offline PDF export with a visible JPEG page per site photograph.
 * React canvas converts PNG/WebP to JPEG before calling this function. */
export function gerarPdfRelatorioComFotos(titulo, secoes = {}, photographicPages = []) {
  if (!photographicPages.length) return gerarPdfRelatorio(titulo,secoes);
  if (photographicPages.length > 12) throw new Error('RDO suporta no máximo 12 fotos.');
  const pages=[];let current={},used=0;
  for (const [section, raw] of Object.entries(secoes)) {
    const items=Array.isArray(raw)?raw:[raw];
    const weight=30+items.reduce((sum,item)=>sum+Math.max(1,Math.ceil(String(item??'').length/92))*17,0);
    if (used && used+weight>610){pages.push(current);current={};used=0;}
    current[section]=items;used+=weight;
  }
  if(Object.keys(current).length)pages.push(current);
  if(!pages.length)pages.push({Resumo:['Nenhum dado informado.']});
  const count=pages.length+photographicPages.length;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',''];
  const kids=[];
  pages.forEach((section,i)=>{
    const content=renderPage(titulo,section,i+1,count);
    const page=objects.length+1,stream=page+1;kids.push(page);
    objects.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+(stream+1)+' 0 R /F2 '+(stream+2)+' 0 R >> >> /Contents '+stream+' 0 R >>',
      '<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    );
  });
  photographicPages.forEach((photo,i)=>{
    const bytes=photo.jpeg,width=Number(photo.width),height=Number(photo.height);
    if(!(bytes instanceof Uint8Array)||bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>10000||height>10000)
      throw new Error('JPEG inválido para anexo do RDO.');
    if(bytes.length>4*1024*1024)throw new Error('Fotografia acima de 4 MiB.');
    const page=objects.length+1,stream=page+1,image=page+2,font=page+3;kids.push(page);
    const scale=Math.min(510/width,630/height);
    const w=(width*scale).toFixed(2),h=(height*scale).toFixed(2);
    const x=((595-Number(w))/2).toFixed(2),y=(710-Number(h)).toFixed(2);
    const commands=[
      rect(0,770,595,72,[0.07,0.24,0.17]),
      text(42,806,'F1',14,[1,1,1],'RDO - Foto '+(i+1)),
      text(42,748,'F1',11,[0.12,0.19,0.17],String(photo.caption||'Foto de campo').slice(0,150)),
      'q '+w+' 0 0 '+h+' '+x+' '+y+' cm /Im1 Do Q',
      text(42,28,'F1',8,[0.4,0.5,0.45],String(pages.length+i+1)+'/'+count)
    ].join('\n');
    let jpg='';for(let offset=0;offset<bytes.length;offset+=32768)jpg+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
    objects.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+font+' 0 R >> /XObject << /Im1 '+image+' 0 R >> >> /Contents '+stream+' 0 R >>',
      '<< /Length '+commands.length+' >>\nstream\n'+commands+'\nendstream',
      '<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+bytes.length+' >>\nstream\n'+jpg+'\nendstream',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    );
  });
  objects[1]='<< /Type /Pages /Kids ['+kids.map(id=>id+' 0 R').join(' ')+'] /Count '+kids.length+' >>';
  let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[0];
  objects.forEach((obj,index)=>{offsets[index+1]=pdf.length;pdf+=(index+1)+' 0 obj\n'+obj+'\nendobj\n';});
  const xref=pdf.length;
  pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')+'\ntrailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return new Blob([Uint8Array.from(pdf,char=>char.charCodeAt(0)&255)],{type:'application/pdf'});
}
