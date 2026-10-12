import {validarCalculoIndependente,listarCoberturaOraculos} from '../validation/independentOracle.js';

// This diagnostic examines records read-only and exposes counts, never raw
// drawings, patient/client identity, RDO photos or workspaces in its export.
const list=(obj,key)=>Array.isArray(obj?.[key])?obj[key]:[];
const nonnegative=(n)=>Number.isFinite(Number(n))&&Number(n)>=0?Number(n):0;
const makeFinding=(code,count,label,action,area,level='review')=>({
 code,count,label,action,area,level
});
function checkCalculation(row,allowed){
 const id=String(row?.tipo||'');
 if(!allowed.has(id))return 'unsupported';
 const input=row?.entradas;
 const output=row?.resultados;
 if(!input||!output||typeof input!=='object'||typeof output!=='object')return 'invalid';
 try{return validarCalculoIndependente(id,input,output).ok?'checked':'invalid';}
 catch{return 'invalid';}
}
export function createEngineeringDiagnostic({works=[],studyCount=0,reviewLinkCount=0,mathOracleCatalog}={}){
 const supported=new Set(mathOracleCatalog||listarCoberturaOraculos());
 const summary={
  workCount:works.length,studyCount:nonnegative(studyCount),reviewLinkCount:nonnegative(reviewLinkCount),mathOracleCount:supported.size,
  rdoCount:0,approvedRdoCount:0,unapprovedRdoCount:0,openIssueCount:0,
  operationalMeasurementCount:0,approvedOperationalMeasurementCount:0,unapprovedOperationalMeasurementCount:0,
  calculationCount:0,mathematicallyCheckedCalculationCount:0,unsupportedCalculationCount:0,unverifiedCalculationCount:0,
  pendingReceiptCount:0,unapprovedStagesCount:0,worksMissingApprovedRdoCount:0
 };
 for(const work of works){
  const rdos=list(work,'rdos'),measures=list(work,'medicoes'),issues=list(work,'pendencias'),stages=list(work,'etapas');
  const calculations=list(work,'calculos'),purchases=list(work,'compras');
  summary.rdoCount+=rdos.length;
  const approved=rdos.filter(x=>x.status_aprovacao==='aprovado').length;
  summary.approvedRdoCount+=approved;
  summary.unapprovedRdoCount+=rdos.length-approved;
  if(approved===0)summary.worksMissingApprovedRdoCount++;
  summary.openIssueCount+=issues.filter(x=>x.status!=='resolvida').length;
  summary.operationalMeasurementCount+=measures.length;
  const approvedMeasures=measures.filter(x=>x.status==='aprovada').length;
  summary.approvedOperationalMeasurementCount+=approvedMeasures;
  summary.unapprovedOperationalMeasurementCount+=measures.length-approvedMeasures;
  summary.pendingReceiptCount+=purchases.filter(x=>nonnegative(x.recebido)<nonnegative(x.quantidade)).length;
  summary.unapprovedStagesCount+=stages.filter(x=>nonnegative(x.percentual_concluido)<100).length;
  for(const calc of calculations){
   summary.calculationCount++;
   const checked=checkCalculation(calc,supported);
   if(checked==='checked')summary.mathematicallyCheckedCalculationCount++;
   else{
    summary.unverifiedCalculationCount++;
    if(checked==='unsupported')summary.unsupportedCalculationCount++;
   }
  }
 }
 const findings=[];
 const add=(code,count,label,action,area,level)=>{if(count>0)findings.push(makeFinding(code,count,label,action,area,level));};
 add('NO_WORK',works.length?0:1,'Nenhuma obra cadastrada','Cadastre ou abra uma obra antes de avaliar fluxos reais.','F7');
 add('F7_UNAPPROVED_RDO',summary.unapprovedRdoCount,'Diários de obra aguardando aprovação','Revise os RDOs com responsável e preserve os aprovados como imutáveis.','F7');
 add('F7_MISSING_APPROVED_RDO',summary.worksMissingApprovedRdoCount,'Obras sem diário aprovado','Registre e aprove ao menos um RDO real por obra.','F7');
 add('F7_OPEN_ISSUES',summary.openIssueCount,'Pendências de obra abertas','Revise responsáveis e impedimentos operacionais antes do encerramento.','F7');
 add('F7_UNAPPROVED_MEASURES',summary.unapprovedOperationalMeasurementCount,'Medições operacionais não aprovadas','Confira competência, frente, unidade, quantidade e responsável.','F7');
 add('F7_PENDING_RECEIPT',summary.pendingReceiptCount,'Pedidos ainda não totalmente recebidos','Confronte pedido com recebimento real. Não infira baixa nem pagamento.','F7','info');
 add('F8_UNSUPPORTED_CALC',summary.unsupportedCalculationCount,'Memórias sem oráculo registrado','Identifique o tipo e revise a memória antes de usá-la.','F8');
 add('F8_UNVERIFIED_CALC',summary.unverifiedCalculationCount,'Memórias sem validação matemática independente válida','Reexecute a validação; não trate a memória legada como homologada.','F8');
 add('F7_INCOMPLETE_STAGES',summary.unapprovedStagesCount,'Etapas com avanço inferior a 100%','Verifique etapas planejadas e execução real.','F7','info');
 if(summary.studyCount>0&&!summary.reviewLinkCount)findings.push(makeFinding('F9_UNLINKED_REVIEW',summary.studyCount,'Estudos sem revisão CBIM rastreada','Confirme vínculos de revisão e proveniência quando houver conversões.','F9','info'));
 return {
  schemaVersion:1,dataScope:'all_works',summary,findings,
  technicalConformityCertified:false,bankReconciled:false,
  humanApprovalRequired:true,releaseReady:false,
  scopeNote:'Dados agregados locais. Não afirma conformidade NBR, conciliação bancária, fidelidade de IFC nem aprovação técnica.'
 };
}
const pilotGates=[
 {id:'clean_windows_install',name:'Instalação em Windows limpo',hint:'Windows 10/11 x64 sem runtimes pré-instalados; abertura e recuperação confirmadas'},
 {id:'semantic_validation',name:'Acurácia de geometria e semântica IFC',hint:'Projetista compara amostras reais DWG e IFC, cotas Z, conectividade e classificação nas disciplinas liberadas'},
 {id:'cross_platform_ifc',name:'Interoperabilidade IFC externa',hint:'Abrir IFC em visualizador independente e, quando aplicável, Revit'},
 {id:'interruption_recovery',name:'Persistência e recuperação reais',hint:'Fechar/interromper aplicação, recuperar revisão e confirmar integridade'},
 {id:'license_offline',name:'Licença e instalador final',hint:'Validar chave pública do emissor, licença válida, inválida, expirada e assinatura do instalador'},
 {id:'client_acceptance',name:'Piloto acompanhado com aceite',hint:'Usuário real conclui tarefa sem orientação; evidências e termo de aceite protegidos fora do repositório'}
];
export function createPilotEvidenceChecklist(_untrustedSelfDeclaration=null){
 return {
  releaseType:'PREVIEW_QA_ONLY',
  humanHomologated:false,commercialReady:false,externalApprovalRequired:true,
  gates:pilotGates.map(gate=>({...gate,state:'pending_external'})),
  note:'O aplicativo não pode certificar auditoria humana por entrada de booleans. Evidências externas assinadas/verificadas devem ser homologadas por responsável habilitado.'
 };
}
export function createSanitizedReleaseExport(diagnostic,{version='unknown',timestamp=new Date().toISOString()}={}){
 const {summary,findings}=diagnostic;
 return {
  schemaVersion:1,createdAt:timestamp,
  productVersion:String(version).replace(/[^a-zA-Z0-9._-]/g,'').slice(0,70)||'unknown',
  distributionScope:'QA_ONLY',humanHomologated:false,commercialReleaseApproved:false,
  diagnostic:{dataScope:'all_works',summary:{...summary},findings:findings.map(x=>({...x}))},
  externalGates:createPilotEvidenceChecklist().gates,
  exclusions:['raw_dwg','ifc_files','rdo_photos','clients','personnel','addresses','workspace_paths','license_keys','bank_transactions'],
  note:'Relatório agregado anônimo para análise de pendências. Não contém dados suficientes para autenticar homologação externa.'
 };
}
