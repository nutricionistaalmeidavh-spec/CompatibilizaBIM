// Módulo reaproveitado do Fluxo DRE, adaptado para o núcleo offline do Engenharia360.
// Mantém a regra de formatação em um único lugar sem importar React/Electron.
export const brl = (centavos = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centavos || 0) / 100);
export const brlReais = (reais = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(reais || 0));
export const brDate = (value) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('pt-BR').format(date);
};
export const today = () => new Date().toISOString().slice(0, 10);
