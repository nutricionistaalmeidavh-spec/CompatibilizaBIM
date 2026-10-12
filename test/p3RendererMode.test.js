import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../app/',import.meta.url);
test('desktop entry is React-only',()=>{
  const html=fs.readFileSync(new URL('index.html',root),'utf8');
  assert.match(html,/react\/main\.tsx/);
  assert.doesNotMatch(html,/bootstrap\.js|rendererMode\.js/);
});
test('React entry chooses review without introducing another renderer',()=>{
  const entry=fs.readFileSync(new URL('src/react/main.tsx',root),'utf8');
  assert.match(entry,/surface/);
  assert.match(entry,/StudioApp/);
  assert.match(entry,/AppShell/);
});
