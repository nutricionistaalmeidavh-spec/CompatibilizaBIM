import React from 'react';
import Gantt from 'frappe-gantt';
import 'frappe-gantt-style';
import { scheduleToGanttTasks } from '../../../../src/bim/visualizationAdapters.js';

type Props = { activities: any[] };
export function CanonicalGantt({ activities }: Props) {
  const host = React.useRef<HTMLDivElement>(null);
  const [failure, setFailure] = React.useState('');
  const tasks = React.useMemo(() => scheduleToGanttTasks(activities), [activities]);
  const omitted = activities.length - tasks.length;

  React.useEffect(() => {
    if (!host.current || !tasks.length) return;
    const target = host.current;
    setFailure('');
    target.replaceChildren();
    try {
      new Gantt(target, tasks, {
        view_mode: 'Week',
        view_mode_select: true,
        readonly: true,
        readonly_dates: true,
        readonly_progress: true,
        popup_on: 'click',
        scroll_to: 'start',
        today_button: true
      });
    } catch (error: any) {
      setFailure(error?.message || 'Não foi possível montar o cronograma gráfico.');
      target.replaceChildren();
    }
    return () => target.replaceChildren();
  }, [tasks]);

  return <section className="cbim-canonical-gantt" aria-label="Cronograma visual 4D">
    <h4>Linha do tempo das atividades</h4>
    <p className="studio-muted">Datas, dependências e avanço lidos do cronograma persistido pelo motor 4D. Arrastar barras não altera a obra.</p>
    {!activities.length && <p role="status">Nenhuma atividade cadastrada. Importe um CSV ou cadastre a primeira atividade acima.</p>}
    {omitted > 0 && <p role="status">{omitted} atividade(s) sem datas válidas permanecem na tabela original e não aparecem no gráfico.</p>}
    {!!tasks.length && <div className="cbim-gantt-scroll"><div ref={host} className="cbim-gantt-host" /></div>}
    {failure && <p role="alert">O cronograma gráfico não foi exibido: {failure}. A lista tabular e os dados 4D permanecem disponíveis.</p>}
  </section>;
}
