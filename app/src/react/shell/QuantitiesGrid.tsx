import React from 'react';
import DataEditor, { GridCellKind } from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import { GRID_COLUMNS, quantityGridDisplay } from '../../../../src/bim/visualizationAdapters.js';

type Props = { mode: 'qto' | 'budget'; records: any[]; onPick?: (row: any) => void };
export function QuantitiesGrid({ mode, records, onPick }: Props) {
  const definitions = GRID_COLUMNS[mode];
  const columns = React.useMemo(() => definitions.map(column => ({
    title: column.title,
    width: column.width
  })), [definitions]);
  const getCellContent = React.useCallback(([column, index]: readonly [number, number]) => {
    const value = quantityGridDisplay(records[index], mode, column);
    return { kind: GridCellKind.Text, data: value, displayData: value, allowOverlay: false, readonly: true } as const;
  }, [records, mode]);
  const handleClick = React.useCallback((location: readonly [number, number]) => {
    if (onPick && records[location[1]]) onPick(records[location[1]]);
  }, [records, onPick]);

  return <section className="cbim-quantities-grid" aria-label={mode === 'qto' ? 'Tabela IFC de quantitativos' : 'Tabela de orçamento 5D'}>
    <p className="studio-muted">{records.length.toLocaleString('pt-BR')} linha(s) carregadas. Navegue pelo teclado; valores extraídos do IFC ou calculados pelo orçamento são somente leitura.</p>
    <DataEditor
      columns={columns}
      rows={records.length}
      getCellContent={getCellContent}
      onCellClicked={handleClick}
      rowMarkers="number"
      smoothScrollX
      smoothScrollY
      height="400px"
      width="100%"
    />
  </section>;
}
