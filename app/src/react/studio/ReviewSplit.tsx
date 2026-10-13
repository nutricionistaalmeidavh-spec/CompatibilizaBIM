import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

type Props = { viewer: React.ReactNode; inspector: React.ReactNode };
export function ReviewSplit({ viewer, inspector }: Props) {
  const [desktop, setDesktop] = React.useState(() => window.matchMedia('(min-width: 901px)').matches);
  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 901px)');
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // Layout proportions are local presentation preferences; no CBIM entity is written.
  if (!desktop) return <section className="review" aria-label="Revisão dos elementos BIM">{viewer}{inspector}</section>;
  return <PanelGroup direction="horizontal" autoSaveId="cbim-review-split-v1" className="review review-split">
    <Panel id="cbim-spatial-viewer" order={1} defaultSize={66} minSize={35}>
      {viewer}
    </Panel>
    <PanelResizeHandle className="review-split-handle" aria-label="Ajustar largura entre visualizador e inspetor" tabIndex={0}>
      <span aria-hidden="true" />
    </PanelResizeHandle>
    <Panel id="cbim-element-inspector" order={2} defaultSize={34} minSize={20}>
      {inspector}
    </Panel>
  </PanelGroup>;
}
