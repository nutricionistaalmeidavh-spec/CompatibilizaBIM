export function calcularVigaFlexao(values = {}) {
  const i = { momentoKNM: 80, larguraCM: 20, alturaCM: 50, cobrimentoCM: 4, fckMPa: 30, fykMPa: 500, ...values };
  const erros = Object.entries(i).filter(([, v]) => !Number.isFinite(v) || v <= 0).map(([k]) => `${k} deve ser maior que zero`);
  if (erros.length) throw new Error(`Entradas inválidas: ${erros.join('; ')}`);
  const d = i.alturaCM - i.cobrimentoCM;
  const fcd = (i.fckMPa / 10) / 1.4;
  const fyd = (i.fykMPa / 10) / 1.15;
  const md = i.momentoKNM;
  const kmd = md * 100 / (i.larguraCM * d ** 2 * fcd);
  const disc = 0.4624 - 1.088 * kmd;
  const xi = disc < 0 ? null : (0.68 - Math.sqrt(disc)) / 0.544;
  const z = xi == null ? null : d - 0.4 * xi * d;
  const asCalc = z == null ? null : md * 100 / (fyd * z);
  const rhoMin = i.fckMPa <= 25 ? 0.0015 : i.fckMPa <= 30 ? 0.00173 : i.fckMPa <= 35 ? 0.00201 : i.fckMPa <= 40 ? 0.0023 : i.fckMPa <= 45 ? 0.00259 : 0.00288;
  const asMin = rhoMin * i.larguraCM * i.alturaCM;
  const asAdotada = asCalc == null ? null : Math.max(asCalc, asMin);
  return {
    entrada: i,
    resultados: { d, fcd, fyd, md, kmd, xi, z, asCalc, rhoMin, asMin, asAdotada, asMax: 0.04 * i.larguraCM * i.alturaCM },
    verificacoes: { ductilidade: xi != null && xi <= 0.45 ? 'OK - armadura simples' : 'REDIMENSIONAR SEÇÃO', armaduraMinima: asCalc != null ? 'OK' : 'REDIMENSIONAR SEÇÃO' },
    metadados: { referencia: 'Planilha_Dimensionamento_Viga_NBR6118.xlsx', normaDeclarada: 'NBR 6118:2014' },
  };
}
