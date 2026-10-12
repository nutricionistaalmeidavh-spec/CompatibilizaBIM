import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleToGanttTasks, GRID_COLUMNS, quantityGridDisplay, measurementSelection } from '../src/bim/visualizationAdapters.js';

test('Gantt uses original activity IDs, dates, predecessors and progress without modifying the input', () => {
  const rows = Object.freeze([
    Object.freeze({ activity_id: 'a', name: 'Montar tubos', start_date: '2026-10-01', end_date: '2026-10-05', predecessors: [], actual_progress: 25 }),
    Object.freeze({ activity_id: 'b', name: 'Testar rede', start_date: '2026-10-06', end_date: '2026-10-07', predecessors: ['a'], actual_progress: 10 })
  ]);
  assert.deepEqual(scheduleToGanttTasks(rows), [
    { id: 'a', name: 'Montar tubos', start: '2026-10-01', end: '2026-10-05', progress: 25, dependencies: '' },
    { id: 'b', name: 'Testar rede', start: '2026-10-06', end: '2026-10-07', progress: 10, dependencies: 'a' }
  ]);
  assert.equal(rows[1].actual_progress, 10);
});

test('Gantt omits malformed dates without creating fictitious activities', () => {
  const result = scheduleToGanttTasks([
    { activity_id: 'x', name: 'Errada', start_date: '2026-02-30', end_date: '2026-03-01' },
    { activity_id: 'y', name: 'Invertida', start_date: '2026-12-02', end_date: '2026-12-01' }
  ]);
  assert.deepEqual(result, []);
});

test('grid displays original traceable QTO and does not round to whole units', () => {
  const source = { global_id: 'IFC-001', value: 1.234567, unit: 'm³', source: 'ifc_quantity', kind: 'volume', quantity_name: 'NetVolume' };
  assert.equal(GRID_COLUMNS.qto[0].key, 'global_id');
  assert.equal(quantityGridDisplay(source, 'qto', 4), '1,234567');
  assert.equal(quantityGridDisplay(source, 'qto', 5), 'm³');
  assert.deepEqual(measurementSelection(source), { guid: 'IFC-001', quantity: 'volume|NetVolume' });
});

test('QTO geometry fallback and incomplete records cannot enter the approved measurement flow', () => {
  assert.equal(measurementSelection({ global_id: 'IFC-002', kind: 'length', quantity_name: 'Length', source: 'geometry_fallback' }), null);
  assert.equal(measurementSelection({ global_id: '', kind: 'length', quantity_name: 'Length', source: 'ifc_quantity' }), null);
});

test('budget cells display currencies without modifying the authoritative amounts', () => {
  const record = Object.freeze({ quantity: 4.125, unit: 'm', final_unit_cost: 100.25, total_cost: 413.53125 });
  assert.equal(quantityGridDisplay(record, 'budget', 2), '4,125');
  assert.match(quantityGridDisplay(record, 'budget', 5), /413,53/);
  assert.equal(record.total_cost, 413.53125);
});
