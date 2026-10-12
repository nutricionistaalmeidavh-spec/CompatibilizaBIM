
import React from 'react';
import { abrirBanco, listarObras, lerWorkspaceContext, salvarWorkspaceContext, exportarBackup, importarBackup } from '../../../../storage/sqliteStore.js';
import { WorksPage } from './WorksPage';
import { BimPage } from './BimPage';
import { CalculatorsPage } from './CalculatorsPage';
import { Status } from '../components/ui';

const sections=['Obras','BIM','Cálculos','Operação','Financeiro','Revisão','Histórico'];
export function AppShell(){
  const [db,setDb]=React.useState<any>(null);
  const [error,setError]=React.useState('');
  const [active,setActive]=React.useState('Obras');
  const [workId,setWorkId]=React.useState<string|null>(null);
  const [version,refresh]=React.useReducer(n=>n+1,0);
  React.useEffect(()=>{let alive=true;abrirBanco().then((database:any)=>{if(!alive)return;setDb(database);setWorkId(lerWorkspaceContext(database).obraId||null);}).catch((e:any)=>setError(e.message));return()=>{alive=false;};},[]);
  const selectWork=(id:string|null)=>{
    if(!db)return;
    const current=lerWorkspaceContext(db);
    salvarWorkspaceContext(db,{...current,obraId:id,frenteId:id===current.obraId?current.frenteId:null});
    setWorkId(id);refresh();
  };
  const downloadBackup=()=>{
    if(!db)return;
    const url=URL.createObjectURL(new Blob([exportarBackup(db)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='compatibilizabim-backup.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const readBackup=async(file:File|null)=>{
    if(!file||!db)return;
    if(!window.confirm('Importar backup substitui o banco atual. Você confirmou ter um backup do banco atual?'))return;
    try{importarBackup(db,await file.text());}catch(e:any){setError(e.message);}
  };
  if(error)return <main role="alert"><h1>Falha ao abrir CompatibilizaBIM</h1><p>{error}</p></main>;
  if(!db)return <main aria-busy="true">Abrindo banco local…</main>;
  const works=listarObras(db);
  const selectedWork=works.find((w:any)=>w.id===workId);
  return <div className="studio-shell cbim-react-app">
    <header className="studio-topbar"><div><span className="studio-product">CompatibilizaBIM</span> <strong>Studio</strong></div>
      <div className="studio-status"><span>{selectedWork?.nome||'Sem obra vinculada'}</span> <Status tone="success">Local · Offline</Status></div></header>
    <aside className="studio-sidebar" aria-label="Navegação única">
      {sections.map(s=><button key={s} className={active===s?'active':''} onClick={()=>setActive(s)}>{s}</button>)}
      <button onClick={downloadBackup}>Exportar backup</button>
      <label>Importar backup<input aria-label="Selecionar arquivo de backup" type="file" accept=".json" onChange={e=>{void readBackup(e.target.files?.[0]||null);e.target.value='';}}/></label>
    </aside>
    <main className="studio-content">
      {active==='Obras'&&<WorksPage db={db} obraId={workId} selectWork={selectWork} onChange={refresh}/>}
      {active==='BIM'&&<BimPage db={db} obraId={workId} version={version} onChange={refresh}/>}
      {active==='Cálculos'&&<CalculatorsPage db={db} obraId={workId} onSaved={refresh}/>}
      {active==='Operação'&&<WorksPage db={db} obraId={workId} selectWork={selectWork} onChange={refresh}/>}
      {active==='Financeiro'&&<section className="cbim-react-section"><h1>Financeiro</h1><p>A reconciliação das telas financeiras com os contratos atuais ainda está pendente. O banco SQLite permanece intacto.</p></section>}
      {active==='Revisão'&&<BimPage db={db} obraId={workId} version={version} onChange={refresh}/>}
      {active==='Histórico'&&<WorksPage db={db} obraId={workId} selectWork={selectWork} onChange={refresh}/>}
    </main>
  </div>;
}
