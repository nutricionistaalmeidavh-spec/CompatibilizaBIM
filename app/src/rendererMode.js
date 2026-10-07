export function resolveRendererMode(search = '') {
  const mode = new URLSearchParams(search).get('renderer');
  return mode === 'react' ? 'react' : 'legacy';
}
