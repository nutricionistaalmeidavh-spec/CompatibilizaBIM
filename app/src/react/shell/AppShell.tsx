
import React from 'react';
import {groupedRoutes,normalizeStudioRoute} from './navigation.js';
import { abrirBanco, listarObras, lerWorkspaceContext, salvarWorkspaceContext, exportarBackup, importarBackup } from '../../../../storage/sqliteStore.js';
import { WorksPage } from './WorksPage';
import { BimPage } from './BimPage';
import { CalculatorsPage } from './CalculatorsPage';
import { QualityPage } from './QualityPage';
import { OperationsPage } from './OperationsPage';
import { FinancePage } from './FinancePage';
import { RdoPage } from './RdoPage';
import { StructuralPage } from './StructuralPage';
import { Status } from '../components/ui';
import {EngineeringBreadcrumbs,EngineeringConfirmDialog,EngineeringFeedback} from '../components/EngineeringUI';
import {studioBreadcrumbs} from '../../../../src/ui/studioPresentation.js';
import {validateWorkspacePeriod} from '../../../../src/domain/workspaceScope.js';
import {createEngineeringTarget,resolveJourneyStudy} from '../../../../src/domain/engineeringJourney.js';
import { validarContratoBackup } from '../../../../src/storage/backupContract.js';
import { listarProjetosBim, listarFrentes } from '../../../../storage/sqliteStore.js';
import { carregarDemo, carregarDemoOperacional, carregarDemoBimIndependente } from '../../demoData.js';
import { enriquecerDemoBim3D, garantirModeloEstruturalDemo } from '../../demoBim3d.js';

const sections=groupedRoutes();
export function AppShell(){
  const [db,setDb]=React.useState<any>(null);
  const [error,setError]=React.useState('');
  const [backupError,setBackupError]=React.useState('');
  const [backupPreview,setBackupPreview]=React.useState<{fileName:string;content:string;created:string;kilobytes:string}|null>(null);
  const [contextError,setContextError]=React.useState('');
  const [active,setActive]=React.useState(()=>{try{return normalizeStudioRoute(sessionStorage.getItem('cbim-studio-section'));}catch{return 'Obras';}});
  const [workId,setWorkId]=React.useState<string|null>(null);
  const [journey,setJourney]=React.useState<any[]>([]);
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
    setWorkId(id);setJourney([]);refresh();
  };
  const updateContext=(patch:any)=>{
    if(!db)return;
    try {
      const current=lerWorkspaceContext(db);
      const next={...current,...patch,periodo:{...current.periodo,...(patch.periodo||{})}};
      validateWorkspacePeriod(next.periodo);
      salvarWorkspaceContext(db,next);
      setContextError('');
      refresh();
    } catch(e:any){setContextError(e.message||String(e));}
  };
  const downloadBackup=()=>{
    if(!db)return;
    const url=URL.createObjectURL(new Blob([exportarBackup(db)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='compatibilizabim-backup.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const readBackup=async(file:File|null)=>{
    if(!file||!db)return;
    try{
      setBackupError('');
      const content=await file.text();
      const preview=validarContratoBackup(content);
      if(!preview.valido)throw new Error(preview.erros.join(' '));
      setBackupPreview({fileName:file.name,content,created:preview.exportadoEm||'não informada',
        kilobytes:((preview.bytes?.length??0)/1024).toFixed(1)});
    }catch(e:any){setBackupError(e.message||String(e));setBackupPreview(null);}
  };
  const confirmBackup=()=>{
    if(!backupPreview||!db)return;
    try{setBackupError('');importarBackup(db,backupPreview.content);}
    catch(e:any){setBackupError(e.message||String(e));setBackupPreview(null);}
  };
  if(error)return <main role="alert"><h1>Falha ao abrir CompatibilizaBIM</h1><p>{error}</p></main>;
  if(!db)return <main aria-busy="true">Abrindo banco local…</main>;
  const works=listarObras(db);
  const selectedWork=works.find((w:any)=>w.id===workId);
  const context=lerWorkspaceContext(db);
  const scope={obraId:workId,frenteId:context.frenteId||null,periodo:context.periodo||{inicio:null,fim:null}};
  const studies=listarProjetosBim(db);
  const selectedStudy=studies.find((s:any)=>s.id===context.projetoBimId);
  const fronts=workId?listarFrentes(db,workId):[];
  const focus=journey.length?journey[journey.length-1].target:null;
  const navigateTo=(route:string,target?:any)=>{
    if(!target){setJourney([]);setActive(route);return;}
    try{
      const nextTarget=createEngineeringTarget(route,target);
      const targetWork=nextTarget.obraId||workId;
      if(targetWork&&!works.some((w:any)=>w.id===targetWork))throw Error('Obra de origem não encontrada. Selecione uma obra válida antes de continuar.');
      const targetStudy=resolveJourneyStudy(studies,context.projetoBimId,nextTarget.studyId,targetWork);
      if(targetWork!==workId||targetStudy!==context.projetoBimId){
        salvarWorkspaceContext(db,{...context,obraId:targetWork,frenteId:targetWork!==workId?null:context.frenteId,projetoBimId:targetStudy});
        setWorkId(targetWork);refresh();
      }
      const current={route:active,target:target.origin||focus,obraId:workId,studyId:context.projetoBimId};
      setJourney(previous=>[...(previous.length?previous:[current]),{route,target:nextTarget,obraId:targetWork,studyId:targetStudy}].slice(-8));
      setContextError('');setActive(route);
    }catch(e:any){setContextError(e.message||String(e));}
  };
  const returnToSource=()=>{
    if(journey.length<2)return;
    const previous=journey[journey.length-2];
    const restoreWork=previous.obraId||null,restoreStudy=previous.studyId||null;
    if(restoreWork!==workId||restoreStudy!==context.projetoBimId){
      salvarWorkspaceContext(db,{...context,obraId:restoreWork,frenteId:restoreWork===workId?context.frenteId:null,projetoBimId:restoreStudy});
      setWorkId(restoreWork);refresh();
    }
    setJourney(history=>history.slice(0,-1));setActive(previous.route);
  };
  return <div className="studio-shell cbim-react-app">
    <header className="studio-topbar"><div><span className="studio-product">CompatibilizaBIM</span> <strong>Studio</strong></div>
      <div className="studio-status"><span>{selectedWork?.nome||'Sem obra vinculada'}</span> <Status tone="success">Local · Offline</Status></div></header>
    <section className="cbim-contextbar" aria-label="Contexto de trabalho">
      <label>Obra<select value={workId||''} onChange={e=>selectWork(e.target.value||null)}><option value="">Sem vínculo</option>{works.map((w:any)=><option key={w.id} value={w.id}>{w.codigo} · {w.nome}</option>)}</select></label>
      <label>Frente<select value={fronts.some((f:any)=>f.id===context.frenteId)?context.frenteId||'':''} disabled={!workId} onChange={e=>updateContext({frenteId:e.target.value||null})}><option value="">Todas as frentes</option>{fronts.map((f:any)=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
      <label>Início<input type="date" value={context.periodo?.inicio||''} onChange={e=>updateContext({periodo:{inicio:e.target.value||null}})}/></label>
      <label>Fim<input type="date" value={context.periodo?.fim||''} onChange={e=>updateContext({periodo:{fim:e.target.value||null}})}/></label>
      <label>Estudo BIM<select value={selectedStudy?.id||''} onChange={e=>updateContext({projetoBimId:e.target.value||null})}><option value="">Escolher no módulo BIM</option>{studies.map((p:any)=><option key={p.id} value={p.id}>{p.nome}{p.obra_id?' · Vinculado':' · Independente'}</option>)}</select></label>
      <span className="cbim-context-link-state" role="status">{!selectedStudy?'Nenhum estudo selecionado':!selectedStudy.obra_id?'Estudo independente':selectedStudy.obra_id===workId?'Estudo vinculado à obra atual':'Estudo vinculado a outra obra'}</span>
      <button onClick={()=>{selectWork(null);updateContext({obraId:null,frenteId:null,periodo:{inicio:null,fim:null},bimMode:'independente',projetoBimId:null});}}>Limpar contexto</button>
    </section>
    <aside className="studio-sidebar" aria-label="Navegação única">
      {sections.map(group=><div className="studio-nav-group" key={group.section}><p className="studio-nav-label">{group.section}</p>{group.routes.map(route=><button key={route.key} type="button" aria-current={active===route.key?'page':undefined} className={active===route.key?'active':''} onClick={()=>navigateTo(route.key)}>{route.key}</button>)}</div>)}
      <button onClick={downloadBackup}>Exportar backup</button>
      <label>Importar backup<input aria-label="Selecionar arquivo de backup" type="file" accept=".json" onChange={e=>{void readBackup(e.target.files?.[0]||null);e.target.value='';}}/></label>
    </aside>
    <main className="studio-content">
      <EngineeringBreadcrumbs items={studioBreadcrumbs({route:active,work:selectedWork,study:active==='BIM'?selectedStudy:null})} onNavigate={navigateTo}/>
      {contextError&&<EngineeringFeedback tone="danger" title="Contexto não atualizado">{contextError}</EngineeringFeedback>}
      {backupError&&<EngineeringFeedback tone="danger" title="Backup não restaurado">{backupError} O banco e a sessão atual foram preservados. Confira o arquivo e tente novamente.</EngineeringFeedback>}
      {journey.length>1&&<nav className="cbim-journey-bar" aria-label="Navegação pelo registro de origem">
        <button type="button" onClick={returnToSource}>← Voltar a {journey[journey.length-2].route} · registro de origem</button>
        <span>Conferência contextual · {focus?.kind||'visão'} {focus?.id?'· '+focus.id:''}{focus?.period?' · '+focus.period:''}</span>
      </nav>}
      <div key={active} className="cbim-route-appear">
      {active==='Obras'&&<WorksPage db={db} obraId={workId} scope={scope} selectWork={selectWork} onChange={refresh} onNavigate={navigateTo}/>}
      {active==='BIM'&&<BimPage db={db} obraId={workId} version={version} onChange={refresh} studyId={context.projetoBimId||''} onSelectStudy={id=>updateContext({projetoBimId:id||null})} target={focus} onNavigate={navigateTo}/>}
      {active==='Cálculos'&&<CalculatorsPage db={db} obraId={workId} studyId={context.projetoBimId||''} onSelectStudy={id=>updateContext({projetoBimId:id||null})} onSaved={refresh}/>}
      {active==='Qualidade'&&<QualityPage db={db} version={version} onNavigate={navigateTo}/>}
      {active==='Estruturas'&&<StructuralPage db={db} obraId={workId} onChange={refresh}/>}
      {active==='RDO'&&<RdoPage db={db} obraId={workId} scope={scope} onChange={refresh} target={focus} onNavigate={navigateTo}/>}
      {active==='Operação'&&<OperationsPage db={db} obraId={workId} scope={scope} onChange={refresh} target={focus} onNavigate={navigateTo}/>}
      {active==='Financeiro'&&<FinancePage db={db} obraId={workId} scope={scope} onChange={refresh} target={focus} onNavigate={navigateTo}/>}
      </div>
    </main>
    <EngineeringConfirmDialog open={!!backupPreview} title="Restaurar banco de dados local?"
      danger typedPhrase="RESTAURAR" confirmLabel="Restaurar SQLite"
      description={<><p><strong>Arquivo:</strong> {backupPreview?.fileName} · {backupPreview?.kilobytes} KiB</p><p><strong>Exportado em:</strong> {backupPreview?.created}</p><p>O banco atual terá cópia anterior, mas arquivos externos e workspaces DWG/IFC não são incluídos neste JSON. A aplicação será reiniciada após a restauração.</p></>}
      onCancel={()=>setBackupPreview(null)} onConfirm={confirmBackup}/>
  </div>;
}
