const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const file = path => readFileSync(join(__dirname, '..', path), 'utf8');

test('all three OSS UI engines are attached to existing React surfaces', () => {
  assert.match(file('app/src/react/studio/ReviewSplit.tsx'), /react-resizable-panels/);
  assert.match(file('app/src/react/studio/StudioApp.tsx'), /<ReviewSplit viewer=/);
  assert.match(file('app/src/react/shell/CanonicalGantt.tsx'), /from 'frappe-gantt'/);
  assert.match(file('app/src/react/shell/QuantitiesGrid.tsx'), /from '@glideapps\/glide-data-grid'/);
  const workbench = file('app/src/react/shell/Bim4D5DPanel.tsx');
  assert.match(workbench, /<Schedule4DWorkspace/);
  assert.match(file('app/src/react/shell/Schedule4DWorkspace.tsx'), /<CanonicalGantt activities=\{visible\}/);
  assert.match(workbench, /<QuantitiesGrid mode="qto"/);
  assert.match(workbench, /<QuantitiesGrid mode="budget"/);
});

test('Gantt and QTO UI cannot mutate canonical Python data via new endpoints', () => {
  assert.doesNotMatch(file('app/src/react/shell/CanonicalGantt.tsx'), /bridge\(|api\('(?:activity|progress)/);
  assert.doesNotMatch(file('app/src/react/shell/QuantitiesGrid.tsx'), /onCellEdited|setRows|saveQuantity/);
  assert.match(file('app/src/react/shell/Bim4D5DPanel.tsx'), /bridge\(\)/);
  assert.match(file('app/src/react/studio/StudioApp.tsx'), /api\('\/api\/workspace'/);
});

test('Frappe Gantt styles are resolved locally despite package exports map', () => {
  assert.match(file('app/vite.config.js'), /frappe-gantt-style/);
  assert.match(file('app/src/react/shell/CanonicalGantt.tsx'), /import 'frappe-gantt-style'/);
});
