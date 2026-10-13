import React from 'react';
import { EngineeringPlot } from './EngineeringPlot';

type MathResult={
  operation:string;expression:string;expression_pretty:string;derivative_pretty:string;integral:string|null;
  result:string;result_pretty:string;numeric_result:number|null;critical_points:{x:number;y:number}[];
  solutions:number[];points:{x:number;y:number|null}[];warnings:string[];engine:string;status:string;
};
export function MathWorkbench(){
  const [expression,setExpression]=React.useState('6*x*(5-x)');
  const [operation,setOperation]=React.useState('analyze');
  const [lower,setLower]=React.useState(0);
  const [upper,setUpper]=React.useState(5);
  const [result,setResult]=React.useState<MathResult|null>(null);
  const [error,setError]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const run=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setResult(null);
    const bridge=(globalThis as any).engineeringStorage?.math?.calculate;
    if(!bridge){setError('Núcleo SymPy disponível no aplicativo desktop, não na prévia do navegador.');return;}
    setBusy(true);
    try{
      const output=await bridge({expression,operation,lower,upper});
      if(!output||output.status!=='estudo_matematico_sem_verificacao_normativa')throw Error('Resultado matemático não confirmado.');
      setResult(output);
    }catch(err:any){setError(err.message||String(err));}
    finally{setBusy(false);}
  };
  return <section className="cbim-react-panel cbim-math-workbench" aria-label="Laboratório matemático local">
    <h2>Laboratório matemático · SymPy local</h2>
    <p className="studio-muted">Estudo simbólico independente. Aceita uma variável (x), operações aritméticas e funções usuais. Não substitui dimensionamento ou normas ABNT. Nenhum serviço externo é utilizado.</p>
    <form onSubmit={run} className="cbim-react-form-grid">
      <label>Expressão f(x)<input type="text" maxLength={160} required value={expression} onChange={e=>setExpression(e.target.value)} placeholder="6*x*(5-x)"/></label>
      <label>Operação<select value={operation} onChange={e=>setOperation(e.target.value)}>
        <option value="analyze">Analisar e localizar extremos</option><option value="differentiate">Derivar</option><option value="integrate">Integral definida</option><option value="solve">Resolver f(x)=0</option>
      </select></label>
      <label>Intervalo — início<input type="number" step="any" value={lower} onChange={e=>setLower(Number(e.target.value))}/></label>
      <label>Intervalo — fim<input type="number" step="any" value={upper} onChange={e=>setUpper(Number(e.target.value))}/></label>
      <button type="submit" disabled={busy}>{busy?'Calculando…':'Calcular localmente'}</button>
    </form>
    {error&&<p role="alert" className="cbim-react-error">{error}</p>}
    {result&&<div aria-label="Resultado matemático">
      <p><strong>Expressão:</strong> <code>{result.expression_pretty}</code></p>
      <p><strong>Derivada:</strong> <code>{result.derivative_pretty}</code></p>
      <p><strong>Resultado:</strong> <code>{result.result_pretty}</code></p>
      {result.integral&&<p><strong>Primitiva simbólica:</strong> <code>{result.integral}</code></p>}
      {result.numeric_result!==null&&<p><strong>Integral definida:</strong> {result.numeric_result}</p>}
      {result.critical_points.length>0&&<p><strong>Pontos críticos:</strong> {result.critical_points.map(p=>'('+p.x.toPrecision(5)+'; '+p.y.toPrecision(5)+')').join(' · ')}</p>}
      {result.solutions.length>0&&<p><strong>Raízes no intervalo:</strong> {result.solutions.join(' · ')}</p>}
      <EngineeringPlot title="Função no intervalo informado" points={result.points} xUnit="x" yUnit="f(x)"/>
      {result.warnings.map((warning,i)=><p key={i} role="status">{warning}</p>)}
      <small>Proveniência: {result.engine}. Estudo matemático sem certificação normativa.</small>
    </div>}
  </section>;
}
