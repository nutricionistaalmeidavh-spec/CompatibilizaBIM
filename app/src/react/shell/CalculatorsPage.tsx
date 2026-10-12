
import React from 'react';
import { CALCULADORAS, CALCULATOR_GROUPS } from '../../calculatorCatalog.js';
import { validarCalculoIndependente } from '../../../../src/validation/independentOracle.js';
import { salvarCalculo } from '../../../../storage/sqliteStore.js';

type CalcDefinition = { label:string; fields:[string,string,number][]; fn:(args:any)=>any };
const catalog = CALCULADORAS as Record<string, CalcDefinition>;

export function CalculatorsPage({db, obraId, onSaved}:{db:any;obraId:string|null;onSaved:()=>void}) {
  const [calculator,setCalculator]=React.useState('');
  const [values,setValues]=React.useState<Record<string,number>>({});
  const [result,setResult]=React.useState<any>(null);
  const [error,setError]=React.useState('');
  const entry=catalog[calculator];
  const select=(id:string)=>{
    setCalculator(id);
    setValues(Object.fromEntries((catalog[id]?.fields || []).map(([key,,value])=>[key,value])));
    setResult(null);
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
      setResult({output,inputs,validation});
      setError('');
    } catch(e:any) {setError(e.message);setResult(null);}
  };
  const save=()=>{
    if (!obraId || !result?.validation?.ok) return;
    try {
      salvarCalculo(db,obraId,{tipo:calculator,titulo:entry.label,entradas:result.inputs,resultados:{...result.output,validacao:result.validation},norma:result.output?.metadados?.normaDeclarada});
      onSaved();setError('Cálculo validado e salvo na obra selecionada.');
    } catch(e:any){setError(e.message);}
  };
  return <section className="cbim-react-section">
    <h1>Biblioteca de cálculos</h1><p>Mesmo catálogo, motores matemáticos e validador independente do renderer original.</p>
    <div className="cbim-react-calc-groups">{CALCULATOR_GROUPS.map((group:any)=><details key={group.id} open={group.ids.includes(calculator)||undefined}>
      <summary><strong>{group.label}</strong><span>{group.ids.length} cálculos</span></summary>
      <div className="cbim-react-card-grid">{group.ids.map((id:string)=><button className={calculator===id?'selected':''} key={id} onClick={()=>select(id)}>{catalog[id]?.label}</button>)}</div>
    </details>)}</div>
    {entry && <form onSubmit={execute} className="cbim-react-panel"><h2>{entry.label}</h2><div className="cbim-react-form-grid">{entry.fields.map(([key,label])=><label key={key}>{label}<input type="number" step="any" required value={values[key]??''} onChange={e=>setValues(current=>({...current,[key]:Number(e.target.value)}))}/></label>)}</div>
      <button type="submit">Calcular e validar</button></form>}
    {error&&<p role="status">{error}</p>}
    {result&&<section className="cbim-react-panel" aria-label="Resultado de cálculo">
      <h2>{result.validation.ok?'Resultado validado':'Resultado requer revisão'}</h2>
      {!result.validation.ok&&<p>{(result.validation.errors||[]).join('; ')}</p>}
      <pre>{JSON.stringify(result.output,null,2)}</pre>
      <p>Norma declarada: {result.output?.metadados?.normaDeclarada||'não informada'}</p>
      <button type="button" onClick={save} disabled={!obraId||!result.validation.ok}>Salvar na obra</button>
    </section>}
  </section>;
}
