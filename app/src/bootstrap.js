import { resolveRendererMode } from './rendererMode.js';

const mode = resolveRendererMode(location.search);
document.documentElement.dataset.renderer = mode;

if (mode === 'react') {
  import('./react/main.tsx');
} else {
  import('./main.js');
}
