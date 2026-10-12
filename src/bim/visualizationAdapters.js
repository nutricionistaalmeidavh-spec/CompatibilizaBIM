// Presentation-only adapters. CBIM/Python remains authoritative for schedules, IFC QTO and budgets.
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function scheduleToGanttTasks(activities = []) {
  if (!Array.isArray(activities)) throw new TypeError('Atividades devem ser uma lista.');
  const ids = new Set(activities.map(item => String(item?.activity_id ?? '')));
  return activities.filter(item => item && String(item.activity_id ?? '').trim()
    && validDate(item.start_date) && validDate(item.end_date)
    && item.end_date >= item.start_date)
    .map(item => {
      const id = String(item.activity_id);
      const predecessors = Array.isArray(item.predecessors) ? item.predecessors : [];
      const amount = Number(item.actual_progress ?? 0);
      return {
        id,
        name: String(item.name || id),
        start: item.start_date,
        end: item.end_date,
        // Frappe Gantt displays progress but must never write it back.
        progress: Number.isFinite(amount) ? Math.max(0, Math.min(100, amount)) : 0,
        dependencies: [...new Set(predecessors.map(String).filter(value => ids.has(value) && value !== id))].join(', ')
      };
    });
}

const number = value => value === null || value === undefined || value === ''
  || !Number.isFinite(Number(value)) ? '—'
  : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 9 }).format(Number(value));
const money = value => value === null || value === undefined || value === ''
  || !Number.isFinite(Number(value)) ? '—'
  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
const text = value => value === null || value === undefined || value === '' ? '—' : String(value);

export const GRID_COLUMNS = Object.freeze({
  qto: Object.freeze([
    { key: 'global_id', title: 'GUID IFC', width: 235 },
    { key: 'ifc_class', title: 'Classe IFC', width: 165 },
    { key: 'storey', title: 'Pavimento', width: 145 },
    { key: 'quantity_name', title: 'Grandeza', width: 175 },
    { key: 'value', title: 'Quantidade', width: 150 },
    { key: 'unit', title: 'Unidade', width: 100 },
    { key: 'source', title: 'Origem QTO', width: 160 }
  ]),
  budget: Object.freeze([
    { key: 'composition_code', title: 'Código', width: 145 },
    { key: 'description', title: 'Serviço', width: 290 },
    { key: 'quantity', title: 'Quantidade', width: 150 },
    { key: 'unit', title: 'Unidade', width: 100 },
    { key: 'final_unit_cost', title: 'Valor unitário', width: 155 },
    { key: 'total_cost', title: 'Valor total', width: 165 }
  ])
});

export function quantityGridDisplay(row, mode, column) {
  const columns = GRID_COLUMNS[mode];
  if (!columns || !columns[column]) throw new RangeError('Coluna de quantitativos inválida.');
  const key = columns[column].key;
  if (key === 'value' || key === 'quantity') return number(row?.[key]);
  if (key === 'total_cost' || key === 'final_unit_cost') return money(row?.[key]);
  return text(row?.[key]);
}

export function measurementSelection(row) {
  if (!row || typeof row.global_id !== 'string' || !row.global_id.trim()
    || !row.kind || !row.quantity_name || row.source === 'geometry_fallback') return null;
  return { guid: row.global_id, quantity: String(row.kind) + '|' + String(row.quantity_name) };
}
