import { validarPerfilNormativo } from './registry.js';

/**
 * Valida a memoria de calculo como artefato de software.
 * Esta rotina verifica perfil, valores numericos e rastreabilidade; ela nao
 * substitui a conferencia de projeto ou a responsabilidade tecnica.
 */
export function validarMemoriaNormativa({ normaDeclarada, resultado = {}, entradas = {} } = {}, opcoes = {}) {
  const perfil = validarPerfilNormativo(normaDeclarada, { exigirVigente: opcoes.exigirVigente !== false });
  const erros = [];
  const avisos = [];
  const numeros = Object.values(resultado).filter((value) => typeof value === 'number');
  if (!normaDeclarada) erros.push('Norma declarada ausente.');
  if (!numeros.every(Number.isFinite)) erros.push('Resultado contem valor numerico invalido.');
  if (perfil.requerRevisao) avisos.push(`Perfil ${perfil.normaVigente || 'nao identificado'} requer reconciliacao de clausulas.`);
  if (!Object.keys(entradas || {}).length) avisos.push('Entradas nao foram preservadas na memoria.');
  const aprovado = erros.length === 0 && perfil.valido && !perfil.requerRevisao;
  return { ...perfil, aprovado, erros, avisos, rastreabilidade: { normaDeclarada: normaDeclarada || null, normaVigente: perfil.normaVigente || null, status: perfil.statusNormativo } };
}
