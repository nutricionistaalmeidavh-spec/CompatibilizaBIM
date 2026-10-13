
import React from 'react';
import { CalculationStudy } from './CalculationStudy';
import { MathWorkbench } from './MathWorkbench';
import { EngineeringAlternativesPanel } from './EngineeringAlternativesPanel';
import { BimStudyLink, BimStudiesHistory } from './BimStudyLink';
import { CALCULADORAS, CALCULATOR_GROUPS } from '../../calculatorCatalog.js';
import { validarCalculoIndependente } from '../../../../src/validation/independentOracle.js';
import { salvarCalculo, listarProjetosBim, buscarProjetoBim } from '../../../../storage/sqliteStore.js';
import { gerarPdfRelatorio } from '../../pdfTemplates.js';
import { exportarDetalhamentoCsv, exportarDetalhamentoDxf, exportarDetalhamentoJson } from '../../../../src/export/detailingExport.js';

const saveFile=(name:string,data:Blob|string,mime:string)=>{
  const blob=data instanceof Blob?data:new Blob([data],{type:mime});
  const link=document.createElement('a'),url=URL.createObjectURL(blob);
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
};
const textLines=(v:any)=>Object.entries(v||{}).map(([k,x])=>k+': '+(typeof x==='object'?JSON.stringify(x):String(x)));
const detailExportIds=new Set(['detalhamentoArmadura','listaAco','quadroFormas']);
type CalcDefinition = { label:string; fields:[string,string,number][]; fn:(args:any)=>any };
const catalog = CALCULADORAS as Record<string, CalcDefinition>;

export function CalculatorsPage({db, obraId, studyId, onSelectStudy, onSaved}:{db:any;obraId:string|null;studyId:string;onSelectStudy:(id:string)=>void;onSaved:()=>void}) {
  const [calculator,setCalculator]=React.useState('');
  const [values,setValues]=React.useState<Record<string,number>>({});
  const [result,setResult]=React.useState<any>(null);
  const [alternatives,setAlternatives]=React.useState<any[]>([]);
  const projects=listarProjetosBim(db);
  const project=studyId?buscarProjetoBim(db,studyId):null;
  const [error,setError]=React.useState('');
  const entry=catalog[calculator];
  const select=(id:string)=>{
    setCalculator(id);
    setValues(Object.fromEntries((catalog[id]?.fields || []).map(([key,,value])=>[key,value])));
    setResult(null);setAlternatives([]);
    setError('');
  };
  const execute=(event:React.FormEvent)=>{
    event.preventDefault();
    try {
      if (!entry) throw new Error('Selecione uma calculadora');
      if (Object.values(values).some(value=>!Number.isFinite(value))) throw new Error('Preencha entradas numéricas válidas');
      const inputs=calculator==='orcamentoCronograma' ? {etapas:[
        {nome:'Fundações',valor:values.fundacoesValor,inicio:values.fundacoesInicio,fim:values.fundacoesFim},
        {nome:'Estrutura',valor:values.estruturaValor,inicio:values.estruturaInicio,fim:values.estruturaFim}
      ]} : values;
      const output=entry.fn(inputs);
      const validation=validarCalculoIndependente(calculator,inputs,output);
      setResult({output,inputs,validation});setAlternatives([]);
      setError('');
    } catch(e:any) {setError(e.message);setResult(null);}
  };
  const exportResult=(format:'pdf'|'csv'|'dxf'|'json')=>{
    if(!result)return;
    const values=result.output?.resultados||result.output;
    try{
      if(format==='pdf'){
        saveFile('calculo-'+calculator+'.pdf',gerarPdfRelatorio('Cálculo - '+entry.label,{
          Entradas:textLines(result.inputs),Resultados:textLines(result.output?.resultados||result.output),
          Validação:[result.validation.ok?'Verificação matemática parcial aprovada':'Divergência matemática; não usar',...(result.validation.errors||[]),...(result.validation.avisos||[])],
          Norma:[result.output?.metadados?.normaDeclarada||'Não declarada']
        }),'application/pdf');
      }
      if(format==='csv')saveFile('detalhamento-'+calculator+'.csv',exportarDetalhamentoCsv(values),'text/csv;charset=utf-8');
      if(format==='dxf')saveFile('detalhamento-'+calculator+'.dxf',exportarDetalhamentoDxf(values,{titulo:entry.label}),'application/dxf');
      if(format==='json')saveFile('calculo-'+calculator+'.json',exportarDetalhamentoJson(values,{titulo:entry.label}),'application/json');
      setError('');
    }catch(e:any){setError(e.message);}
  };
  const save=()=>{
    if (!obraId || !result?.validation?.ok) return;
    try {
      salvarCalculo(db,obraId,{tipo:calculator,titulo:entry.label,entradas:result.inputs,resultados:{...result.output,validacao:result.validation},norma:result.output?.metadados?.normaDeclarada});
      onSaved();setError('Memória de cálculo preliminar salva com a evidência matemática e ressalvas normativas.');
    } catch(e:any){setError(e.message);}
  };
  return <section className="cbim-react-section">
    <h1>Biblioteca de cálculos</h1><p>34 ferramentas com verificações independentes por equação ou dimensionalidade. Verificação matemática parcial não é homologação normativa, projeto executivo ou ART.</p>
    <div className="cbim-react-panel cbim-math-context"><h2>Contexto dos cálculos</h2>
      <label>Estudo BIM (opcional; independente da obra)<select value={studyId||''} onChange={e=>{onSelectStudy(e.target.value);setResult(null);setAlternatives([]);}}>
        <option value="">Cálculo independente do BIM / memória da obra</option>
        {projects.map((p:any)=><option key={p.id} value={p.id}>{p.nome}{p.obra_id?' · obra vinculada':' · independente'}</option>)}
      </select></label>
      <p className="studio-muted">{project?'A vinculação a modelo, revisão, elemento e pendência será escolhida depois do cálculo.':'Selecione um estudo BIM para salvar memória contextualizada; sem estudo selecionado, o fluxo legado de obra permanece disponível.'}</p>
    </div>
    <div className="cbim-react-calc-groups">{CALCULATOR_GROUPS.map((group:any,index:number)=><details key={group.id} open={index===0||group.ids.includes(calculator)||undefined}>
      <summary><strong>{group.label}</strong><span>{group.ids.length} cálculos</span></summary>
      <div className="cbim-react-card-grid">{group.ids.map((id:string)=><button className={calculator===id?'selected':''} key={id} onClick={()=>select(id)}>{catalog[id]?.label}</button>)}</div>
    </details>)}</div>
    {entry && <form onSubmit={execute} className="cbim-react-panel"><h2>{entry.label}</h2><div className="cbim-react-form-grid">{entry.fields.map(([key,label])=><label key={key}>{label}<input type="number" step="any" required value={values[key]??''} onChange={e=>setValues(current=>({...current,[key]:Number(e.target.value)}))}/></label>)}</div>
      <button type="submit">Calcular e validar</button></form>}
    {error&&<p role="status">{error}</p>}
    {result&&<section className="cbim-react-panel" aria-label="Resultado de cálculo">
      <h2>{result.validation.ok?'Verificação matemática parcial aprovada':'Resultado bloqueado: divergência matemática'}</h2>
      {!result.validation.ok&&<p role="alert">{(result.validation.errors||[]).join('; ')}</p>}
      <p role="status">Oráculo: {result.validation.metodo}. {result.validation.verificacoes.length} teste(s) independente(s) · Estado normativo: {result.validation.normaPendente?'Revisão obrigatória':'Perfil declarado; revisão técnica obrigatória'}.</p>
      <p className="studio-muted">{(result.validation.avisos||[]).join(' ')}</p>
<CalculationStudy key={calculator} calculator={calculator} entry={entry} result={result}/>
      {calculator==='orcamentoCronograma'
        ?<p className="studio-muted">O dimensionamento inverso não é aplicável ao cronograma composto: períodos e etapas exigem um solucionador específico.</p>
        :<EngineeringAlternativesPanel key={calculator+'-'+JSON.stringify(result.inputs)} calculator={calculator} entry={entry}
           inputs={result.inputs} output={result.output} onAlternatives={setAlternatives}
           onApply={(inputs)=>{setValues(inputs);setResult(null);setAlternatives([]);setError('Parâmetros carregados. Execute novamente o cálculo e a validação para registrá-los.');}}/>}
      {project&&<BimStudyLink key={project.id+'-'+calculator} db={db} obraId={obraId} project={project} calculator={calculator} entry={entry}
        result={result} alternatives={alternatives} onSaved={onSaved}/>}
      <p>Norma declarada: {result.output?.metadados?.normaDeclarada||'não informada'}</p>
      <div className="cbim-react-toolbar">{!project&&<button type="button" onClick={save} disabled={!obraId||!result.validation.ok}>Salvar memória preliminar na obra</button>}
        <button type="button" onClick={()=>exportResult('pdf')}>Memória PDF</button>
        <button type="button" onClick={()=>exportResult('json')}>Exportar JSON</button>
        {detailExportIds.has(calculator)&&<><button type="button" onClick={()=>exportResult('csv')}>Detalhamento CSV</button><button type="button" onClick={()=>exportResult('dxf')}>Detalhamento DXF</button></>}</div>
    </section>}
    {project&&<BimStudiesHistory db={db} project={project}/>}
    <MathWorkbench/>
  </section>;
}
