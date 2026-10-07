import React from 'react';

const sections=['Projetos','Importação','Conversão','Revisão','Pendências','Histórico'];

export function AppShell(){
  const [active,setActive]=React.useState('Projetos');
  return <div className="studio-shell">
    <header className="studio-topbar">
      <div><span className="studio-product">CompatibilizaBIM</span><strong>Studio</strong></div>
      <div className="studio-status" role="status">Local · Offline</div>
    </header>
    <aside className="studio-sidebar" aria-label="Navegação do Studio">
      {sections.map(section=><button key={section} className={active===section?'active':''} onClick={()=>setActive(section)}>{section}</button>)}
    </aside>
    <main className="studio-content">
      <section className="studio-page">
        <p className="eyebrow">RENDERER REACT · F3</p>
        <h1>{active}</h1>
        <p className="studio-muted">Nova camada de apresentação em migração controlada. O CBIM Core, o WorkspaceStore e os contratos canônicos permanecem como fonte de verdade.</p>
        <div className="studio-card">
          <strong>Paridade protegida</strong>
          <p>As telas funcionais serão migradas progressivamente nas próximas fases. Use <code>?renderer=legacy</code> para a referência congelada durante a comparação.</p>
        </div>
      </section>
    </main>
  </div>;
}
