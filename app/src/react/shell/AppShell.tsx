
import React from 'react';
import { abrirBanco, listarObras, lerWorkspaceContext, salvarWorkspaceContext, exportarBackup, importarBackup } from '../../../../storage/sqliteStore.js';
import { WorksPage } from './WorksPage';
import { BimPage } from './BimPage';
import { CalculatorsPage } from './CalculatorsPage';
import { OperationsPage } from './OperationsPage';
import { FinancePage } from './FinancePage';
import { RdoPage } from './RdoPage';
import { StructuralPage } from './StructuralPage';
import { Status } from '../components/ui';
import { listarProjetosBim, listarFrentes } from '../../../../storage/sqliteStore.js';
import { carregarDemo, carregarDemoOperacional, carregarDemoBimIndependente } from '../../demoData.js';
import { enriquecerDemoBim3D, garantirModeloEstruturalDemo } from '../../demoBim3d.js';

const sections=['Obras','BIM','Cálculos','Estruturas','Operação','RDO','Financeiro','Revisão','Histórico'];
export function AppShell(){
  const [db,setDb]=React.useState<any>(null);
  const [error,setError]=React.useState('');
  const [active,setActive]=React.useState(()=>{try{return sessionStorage.getItem('cbim-studio-section')||'Obras';}catch{return 'Obras';}});
  const [workId,setWorkId]=React.useState<string|null>(null);
  const [version,refresh]=React.useReducer(n=>n+1,0);
  React.useEffect(()=>{
    let alive=true;
    abrirBanco().then((database:any)=>{
      if(!alive)return;
      if(new URLSearchParams(location.search).get('demo')==='1'){
        if(!listarObras(database).length)carregarDemo(database);
        if(!listarProjetosBim(database).some((x:any)=>x.id==='demo-bim-001'))carregarDemoBimIndependente(database);
        if(listarObras(database).some((x:any)=>x.id==='demo-obra-001')&&!listarFrentes(database,'demo-obra-001').length)carregarDemoOperacional(database);
        enriquecerDemoBim3D(database);
        if(listarObras(database).some((x:any)=>x.id==='demo-obra-001'))garantirModeloEstruturalDemo(database,'demo-obra-001');
      }
      setDb(database);
      const saved=lerWorkspaceContext(database).obraId;
      setWorkId(saved&&listarObras(database).some((w:any)=>w.id===saved)?saved:null);
    }).catch((e:any)=>{if(alive)setError(e.message);});
    return()=>{alive=false;};
  },[]);
  React.useEffect(()=>{try{sessionStorage.setItem('cbim-studio-section',active);}catch{}},[active]);
  const selectWork=(id:string|null)=>{
    if(!db)return;
    const current=lerWorkspaceContext(db);
    salvarWorkspaceContext(db,{...current,obraId:id,frenteId:id===current.obraId?current.frenteId:null});
    setWorkId(id);refresh();
  };
  const updateContext=(patch:any)=>{
    if(!db)return;
    const current=lerWorkspaceContext(db);
    salvarWorkspaceContext(db,{...current,...patch,periodo:{...current.periodo,...(patch.periodo||{})}});
    refresh();
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
  const context=lerWorkspaceContext(db);
  const fronts=workId?listarFrentes(db,workId):[];
  return <div className="studio-shell cbim-react-app">
    <header className="studio-topbar"><div><span className="studio-product">CompatibilizaBIM</span> <strong>Studio</strong></div>
      <div className="studio-status"><span>{selectedWork?.nome||'Sem obra vinculada'}</span> <Status tone="success">Local · Offline</Status></div></header>
    <section className="cbim-contextbar" aria-label="Contexto de trabalho">
      <label>Obra<select value={workId||''} onChange={e=>selectWork(e.target.value||null)}><option value="">Sem vínculo</option>{works.map((w:any)=><option key={w.id} value={w.id}>{w.codigo} · {w.nome}</option>)}</select></label>
      <label>Frente<select value={fronts.some((f:any)=>f.id===context.frenteId)?context.frenteId||'':''} disabled={!workId} onChange={e=>updateContext({frenteId:e.target.value||null})}><option value="">Todas as frentes</option>{fronts.map((f:any)=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
      <label>Início<input type="date" value={context.periodo?.inicio||''} onChange={e=>updateContext({periodo:{inicio:e.target.value||null}})}/></label>
      <label>Fim<input type="date" value={context.periodo?.fim||''} onChange={e=>updateContext({periodo:{fim:e.target.value||null}})}/></label>
      <label>BIM<select value={context.bimMode||'independente'} onChange={e=>updateContext({bimMode:e.target.value})}><option value="independente">Independente</option><option value="vinculado">Vinculado</option></select></label>
      <button onClick={()=>{selectWork(null);updateContext({obraId:null,frenteId:null,periodo:{inicio:null,fim:null},bimMode:'independente'});}}>Limpar contexto</button>
    </section>
    <aside className="studio-sidebar" aria-label="Navegação única">
      {sections.map(s=><button key={s} className={active===s?'active':''} onClick={()=>setActive(s)}>{s}</button>)}
      <button onClick={downloadBackup}>Exportar backup</button>
      <label>Importar backup<input aria-label="Selecionar arquivo de backup" type="file" accept=".json" onChange={e=>{void readBackup(e.target.files?.[0]||null);e.target.value='';}}/></label>
    </aside>
    <main className="studio-content">
      {active==='Obras'&&<WorksPage db={db} obraId={workId} selectWork={selectWork} onChange={refresh} onNavigate={setActive}/>}
      {active==='BIM'&&<BimPage db={db} obraId={workId} version={version} onChange={refresh}/>}
      {active==='Cálculos'&&<CalculatorsPage db={db} obraId={workId} onSaved={refresh}/>}
      {active==='Estruturas'&&<StructuralPage db={db} obraId={workId} onChange={refresh}/>}
      {active==='RDO'&&<RdoPage db={db} obraId={workId} onChange={refresh}/>}
      {active==='Operação'&&<OperationsPage db={db} obraId={workId} onChange={refresh}/>}
      {active==='Financeiro'&&<FinancePage db={db} obraId={workId} onChange={refresh}/>}
      {active==='Revisão'&&<BimPage db={db} obraId={workId} version={version} onChange={refresh}/>}
      {active==='Histórico'&&<WorksPage db={db} obraId={workId} selectWork={selectWork} onChange={refresh}/>}
    </main>
  </div>;
}
