import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRendererMode } from '../app/src/rendererMode.js';

test('legacy renderer remains the compatibility default during F3', () => {
  assert.equal(resolveRendererMode(''), 'legacy');
  assert.equal(resolveRendererMode('?renderer=legacy'), 'legacy');
});

test('React renderer is opt-in during parity migration', () => {
  assert.equal(resolveRendererMode('?renderer=react'), 'react');
  assert.equal(resolveRendererMode('?renderer=react&demo=1'), 'react');
});

test('unknown renderer values fail closed to legacy', () => {
  assert.equal(resolveRendererMode('?renderer=other'), 'legacy');
});
