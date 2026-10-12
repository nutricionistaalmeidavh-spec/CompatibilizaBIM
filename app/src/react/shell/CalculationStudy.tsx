import React from 'react';
import { EngineeringPlot } from './EngineeringPlot';
import { listarResultadosTecnicos, formatarValorTecnico, gerarSensibilidade } from '../../../../src/engineering/mathPresentation.js';
import { diagramasVigaBiapoiada } from '../../../../src/engineering/beamDiagrams.js';

type Props={calculator:string;entry:{fields:[string,string,number][];fn:(values:any)=>any};result:{inputs:any;output:any;validation:any}};
export function CalculationStudy({calculator,entry,result}:Props) {
  const rows=listarResultadosTecnicos(result.output);
  const numeric=rows.filter(row=>typeof row.value==='number'&&Number.isFinite(row.value));
  const prefix=result.output?.resultados?'resultados.':'';
  const [parameter,setParameter]=React.useState(entry.fields[0]?.[0]||'');
  const firstVerified=result.validation?.verificacoes?.[0]?.campo;
  const [metric,setMetric]=React.useState(firstVerified||(numeric[0]?prefix+numeric[0].path:''));
  const sensitivity=React.useMemo(()=>{
    try{return metric?gerarSensibilidade({definition:entry,inputs:result.inputs,inputKey:parameter,resultPath:metric}):null;}
    catch{return null;}
  },[entry,result.inputs,parameter,metric]);
  const beam=React.useMemo(()=>{
    if(!['vigaBiapoiada','vigaMetalica'].includes(calculator))return null;
    try{return diagramasVigaBiapoiada(result.inputs);}catch{return null;}
  },[calculator,result.inputs]);
  return <>
    <section className="cbim-math-output" aria-label="Memória técnica estruturada">
      <h3>Resultados e grandezas</h3>
      <p className="studio-muted">Grandezas mantidas nas unidades originais das calculadoras. Resultados são preliminares e exigem conferência técnica.</p>
      <div className="cbim-math-results">
        {rows.map(row=><div key={row.path} className="cbim-math-result">
          <span title={row.path}>{row.label}</span><strong>{formatarValorTecnico(row.value)}{row.unit?' '+row.unit:''}</strong>
        </div>)}
      </div>
      {rows.length===0&&<p>Não há grandezas escalares disponíveis neste cálculo.</p>}
    </section>
    {beam&&<section aria-label="Diagramas de viga idealizada">
      <h3>Diagramas analíticos — caso idealizado</h3>
      <p className="studio-muted">{beam.ressalva} Carga total: {formatarValorTecnico(beam.loadKNM)} kN/m; momento máximo: {formatarValorTecnico(beam.momentoMaxKNM)} kN·m.</p>
      <EngineeringPlot title="Momento fletor M(x)" points={beam.momento} xUnit="m" yUnit="kN·m" note="Viga simplesmente apoiada com carregamento uniforme"/>
      <EngineeringPlot title="Esforço cortante V(x)" points={beam.cortante} xUnit="m" yUnit="kN" note="Convenção de sinal do caso idealizado"/>
    </section>}
    <section className="cbim-math-sensitivity" aria-label="Análise paramétrica">
      <h3>Análise de sensibilidade</h3>
      <p className="studio-muted">Recalcula o motor existente variando um parâmetro de −20% a +20%. Mantém os demais parâmetros fixos; não é otimização nem verificação normativa.</p>
      <div className="cbim-react-form-grid">
        <label>Parâmetro de entrada<select value={parameter} onChange={e=>setParameter(e.target.value)}>
          {entry.fields.map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Grandeza de saída<select value={metric} onChange={e=>setMetric(e.target.value)}>
          {numeric.map(row=><option key={row.path} value={prefix+row.path}>{row.label}</option>)}
        </select></label>
      </div>
      {sensitivity?<><EngineeringPlot title="Variação paramétrica" points={sensitivity.points} xUnit={entry.fields.find(f=>f[0]===parameter)?.[1].match(/\((.*?)\)/)?.[1]||''} yUnit={rows.find(row=>prefix+row.path===metric)?.unit||''}/><div className="cbim-math-table"><table><thead><tr><th>Parâmetro</th><th>Resultado</th></tr></thead><tbody>
        {sensitivity.points.map((p,i)=><tr key={i}><td>{formatarValorTecnico(p.x)}</td><td>{p.y===null?'Não calculável':formatarValorTecnico(p.y)}</td></tr>)}
      </tbody></table></div></>:<p role="status">A combinação selecionada não gerou uma série numérica comparável.</p>}
    </section>
  </>;
}
