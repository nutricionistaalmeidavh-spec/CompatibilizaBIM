import React from 'react';
import {ModuleHero,ModuleKpis} from './EngineeringModuleLayout';
import {listarResumosQualidadeObras,listarProjetosBim,listarModuleLinks} from '../../../../storage/sqliteStore.js';
import {REVIEW_LINK} from '../../../../src/domain/p1Traceability.js';
import {createEngineeringDiagnostic,createPilotEvidenceChecklist,createSanitizedReleaseExport} from '../../../../src/domain/p3ReleaseReadiness.js';
import {Metric,Status} from '../components/ui';
import {version as appVersion} from '../../../package.json';

type Props={db:any;version:number;onNavigate:(route:string)=>void};
const download=(filename:string,content:string)=>{
 const blob=new Blob([content],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
export function QualityPage({db,version,onNavigate}:Props){
 const [tab,setTab]=React.useState<'Diagnóstico'|'Homologação'>('Diagnóstico');
 const diagnostic=React.useMemo(()=>{
  const works=listarResumosQualidadeObras(db);
  const studies=listarProjetosBim(db);
  const links=listarModuleLinks(db);
  return createEngineeringDiagnostic({works,studyCount:studies.length,reviewLinkCount:links.filter((x:any)=>x.module_id===REVIEW_LINK).length});
 },[db,version]);
 const pilot=createPilotEvidenceChecklist();
 const stats=diagnostic.summary;
 return <section className="cbim-react-section cbim-quality cbim-p5-module cbim-p5-quality" data-testid="cbim-p5-quality" aria-label="Centro de qualidade e homologação">
  <ModuleHero area="ENGENHARIA / VERIFICAÇÃO" title="Qualidade e homologação"
    description="Diagnóstico de evidências locais e pendências verificáveis, mantendo o limite entre testes de software e aceite técnico."
    ><Status tone="warning">Preview QA · não homologado</Status></ModuleHero>
  <ModuleKpis items={[
   {label:'Obras examinadas',value:stats.workCount,source:'Todas as obras locais'},
   {label:'RDOs aprovados',value:stats.approvedRdoCount,source:'Registros aprovados · SQLite',tone:'green'},
   {label:'Pendências abertas',value:stats.openIssueCount,source:'Obras · execução',tone:'amber'},
   {label:'Memórias sem validação',value:stats.unverifiedCalculationCount,source:'Não considerar aprovadas',tone:'purple'}
  ]}/>
  <nav className="cbim-react-toolbar" aria-label="Áreas do centro de qualidade">
   {(['Diagnóstico','Homologação'] as const).map(x=><button type="button" key={x} aria-pressed={tab===x} className={tab===x?'selected':''} onClick={()=>setTab(x)}>{x}</button>)}
  </nav>
  {tab==='Diagnóstico'&&<>
   <p className="studio-muted">Escopo: todas as obras e competências, independentemente dos filtros do cabeçalho. O diagnóstico é somente leitura. O aplicativo não infere conformidade NBR, conciliação bancária, fidelidade IFC ou aprovação humana.</p>
   <div className="cbim-closeout-metrics">
    <Metric label="Obras examinadas" value={String(stats.workCount)} source="Cadastros locais · todas as obras"/>
    <Metric label="RDOs aprovados" value={String(stats.approvedRdoCount)} source={stats.unapprovedRdoCount+' rascunho(s)/pendente(s) · F7'}/>
    <Metric label="Medições aprovadas" value={String(stats.approvedOperationalMeasurementCount)} source={stats.unapprovedOperationalMeasurementCount+' medição(ões) sem aprovação · F7'}/>
    <Metric label="Pendências abertas" value={String(stats.openIssueCount)} source="Obras · execução"/>
    <Metric label="Oráculos matemáticos" value={String(stats.mathOracleCount)} source={stats.mathematicallyCheckedCalculationCount+' memórias verificadas de '+stats.calculationCount+' · F8'}/>
    <Metric label="Memórias sem validação" value={String(stats.unverifiedCalculationCount)} source={stats.unsupportedCalculationCount+' sem tipo/oráculo reconhecido · F8'}/>
    <Metric label="Estudos BIM" value={String(stats.studyCount)} source={stats.reviewLinkCount+' vínculos de revisão CBIM · F9'}/>
    <Metric label="Compras a receber" value={String(stats.pendingReceiptCount)} source="Compras; não são despesas contabilizadas"/>
   </div>
   <section className="cbim-react-panel" aria-label="Pendências de qualidade">
    <h2>Alertas verificáveis nos dados</h2>
    {diagnostic.findings.length?<div className="cbim-quality-findings">{diagnostic.findings.map((issue:any)=>
     <article key={issue.code}><span className="cbim-quality-code">{issue.area} · {issue.code}</span>
      <div><strong>{issue.count} · {issue.label}</strong><p className="studio-muted">{issue.action}</p></div>
      <Status tone={issue.level==='info'?'neutral':'warning'}>{issue.level==='info'?'Informativo':'Revisar'}</Status>
     </article>)}</div>:<p>Não há inconsistências nos critérios automatizados desta lista. Isso não confirma conformidade técnica nem homologação comercial.</p>}
    <div className="cbim-react-toolbar"><button type="button" onClick={()=>onNavigate('RDO')}>Abrir RDO</button>
     <button type="button" onClick={()=>onNavigate('Cálculos')}>Conferir calculadoras</button>
     <button type="button" onClick={()=>onNavigate('Operação')}>Revisar medições</button>
     <button type="button" onClick={()=>onNavigate('BIM')}>Revisar BIM</button></div>
   </section>
   <div className="cbim-react-panel">
    <h2>Exportar diagnóstico sem dados de cliente</h2>
    <p>Exporta apenas contagens, códigos de pendências, status externo pendente, data e versão. Não inclui nomes, desenhos DWG/IFC, RDOs, fotos, GUIDs, documentos, caminhos, dados bancários ou licenças.</p>
    <button type="button" onClick={()=>download('cbim-p3-diagnostico-qa.json',JSON.stringify(createSanitizedReleaseExport(diagnostic,{version:appVersion}),null,2))}>Exportar diagnóstico JSON (sem dados pessoais)</button>
   </div>
  </>}
  {tab==='Homologação'&&<>
   <p role="status" className="cbim-quality-warning">Aprovação comercial não pode ser obtida por preencher caixas na interface. Os testes de CI verificam software e artefatos; os critérios abaixo exigem evidência externa auditável e aceite técnico.</p>
   <div className="cbim-react-panel">
    <h2>Gates externos obrigatórios · F9</h2>
    <div className="cbim-quality-gates">{pilot.gates.map(gate=><article key={gate.id}>
      <div><strong>{gate.name}</strong><p className="studio-muted">{gate.hint}</p></div>
      <Status tone="warning">Pendente externo</Status>
    </article>)}</div>
   </div>
   <div className="cbim-react-panel"><h2>O que o CI comprova</h2>
    <p>Execução automatizada Node, testes Python, segurança, navegação React, comparação com DWGs reais, runtime Windows, verificação SHA-256 e geração do instalador NSIS de preview quando todos os gates estiverem verdes.</p>
    <p><strong>O que o CI não comprova:</strong> instalação limpa sem pré-requisitos, assinatura e licença comercial real, revisão humana de classificações IFC/BCF, conformidade atualizada da NBR, ensaios com usuário e aceite do cliente.</p>
    <p className="studio-muted">O checklist do piloto fica em docs/pilot/P1_PILOT_EVIDENCE_TEMPLATE.json. Não altere indicadores para “aprovado” sem as evidências reais; mantenha documentação sensível fora do repositório público.</p>
    <button type="button" onClick={()=>download('cbim-p3-pendencias-homologacao.json',JSON.stringify({
      schemaVersion:1,releaseScope:'QA_ONLY',humanHomologated:false,
      gates:pilot.gates,notes:pilot.note
    },null,2))}>Exportar checklist de homologação pendente</button>
   </div>
  </>}
 </section>;
}
