const PROFILES = Object.freeze({
  'NBR 6118:2014': { vigente: 'ABNT NBR 6118:2026', status: 'reconciliacao_pendente' },
  'NBR 8800:2008': { vigente: 'ABNT NBR 8800:2024', status: 'reconciliacao_pendente' },
  'NBR 5626:2020': { vigente: 'ABNT NBR 5626:2020', status: 'referencia_atual' },
  'NBR 6122:2019': { vigente: 'ABNT NBR 6122:2019', status: 'referencia_atual' },
  'NBR 10844:1989': { vigente: 'ABNT NBR 10844:1989', status: 'referencia_atual' },
  'NBR 9649:1986': { vigente: 'ABNT NBR 9649:1986', status: 'confirmar_exigencias_locais' },
});

export function enriquecerMetadados(metadados = {}) {
  const declarado = String(metadados.normaDeclarada || '');
  const profile = Object.entries(PROFILES).find(([key]) => declarado.includes(key))?.[1];
  return { ...metadados, normaVigente: profile?.vigente || null, statusNormativo: profile?.status || 'sem_perfil' };
}

export function listarPerfisNormativos() {
  return Object.entries(PROFILES).map(([origem, profile]) => ({ origem, ...profile }));
}

export function validarPerfilNormativo(declarado, opcoes = {}) {
  const meta = enriquecerMetadados({ normaDeclarada: declarado });
  const exigido = opcoes.exigirVigente === true;
  return { ...meta, valido: Boolean(meta.normaVigente) && (!exigido || meta.statusNormativo === 'referencia_atual'), requerRevisao: meta.statusNormativo !== 'referencia_atual' };
}
