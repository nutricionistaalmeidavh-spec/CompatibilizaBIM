/** Política única de análises BIM: jamais apresentar IFC não processado como "sem conflitos". */
function nomeArquivo(modelo) {
  return String(modelo?.arquivo_nome || modelo?.arquivoNome || modelo?.nome || '').trim();
}

export function formatoModeloBim(modelo) {
  const nome = nomeArquivo(modelo).toLowerCase();
  if (nome.endsWith('.ifc')) return 'ifc';
  if (nome.endsWith('.json')) return 'manifesto';
  return 'desconhecido';
}

export function planejarAnaliseBim(modelos, { motorIfcDisponivel = false } = {}) {
  if (!Array.isArray(modelos) || modelos.length !== 2) {
    throw new Error('Selecione exatamente dois modelos para analisar; nenhum arquivo será ignorado.');
  }
  const [a, b] = modelos;
  const formatA = formatoModeloBim(a);
  const formatB = formatoModeloBim(b);
  if (formatA === 'desconhecido' || formatB === 'desconhecido') {
    throw new Error('Formato BIM não suportado. Importe arquivos IFC ou manifestos JSON.');
  }
  if (formatA !== formatB) {
    throw new Error('Os dois modelos devem ter o mesmo formato; converta o DWG para IFC antes de analisar.');
  }
  if (formatA === 'ifc') {
    if (!a.arquivo_base64 || !b.arquivo_base64) {
      throw new Error('Arquivos IFC originais ausentes. Reimporte os dois modelos antes de analisar.');
    }
    if (!motorIfcDisponivel) {
      throw new Error('O motor IFC real não está disponível. Não é possível concluir análise apenas pelo cabeçalho do arquivo.');
    }
    return { formato: 'ifc', status: 'concluida_ifc' };
  }
  if (![a, b].every(m => Array.isArray(m.elementos) && m.elementos.length > 0)) {
    throw new Error('Manifesto sem geometria: forneça elementos com coordenadas antes de analisar.');
  }
  return { formato: 'manifesto', status: 'concluida_manifesto' };
}

export async function executarAnaliseBim(modelos, { analisarIfc, analisarManifestos, opcoes = {} } = {}) {
  const plano = planejarAnaliseBim(modelos, { motorIfcDisponivel: typeof analisarIfc === 'function' });
  let conflitos;
  if (plano.formato === 'ifc') {
    const resultado = await analisarIfc(modelos.map(m => ({ name: nomeArquivo(m), base64: m.arquivo_base64 })), opcoes);
    if (!resultado || !Array.isArray(resultado.conflitos)) {
      throw new Error('Resposta inválida do motor IFC. A análise não foi salva como concluída.');
    }
    conflitos = resultado.conflitos;
  } else {
    if (typeof analisarManifestos !== 'function') {
      throw new Error('Analisador de geometria dos manifestos indisponível.');
    }
    conflitos = await analisarManifestos(modelos, opcoes);
    if (!Array.isArray(conflitos)) {
      throw new Error('Resposta inválida do analisador de manifestos.');
    }
  }
  return { conflitos, status: plano.status, formato: plano.formato };
}
