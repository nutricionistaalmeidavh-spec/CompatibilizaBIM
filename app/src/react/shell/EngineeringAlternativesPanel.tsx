import React from 'react';
import { buscarDimensionamentoInverso, compararAlternativas } from '../../../../src/engineering/inverseDesign.js';
import { listarResultadosTecnicos, formatarValorTecnico } from '../../../../src/engineering/mathPresentation.js';
import { EngineeringPlot } from './EngineeringPlot';

type Constraint={path:string;operator:'<='|'>=';limit:number};
type Props={calculator:string;entry:{fields:[string,string,number][];fn:(a:any)=>any};
 inputs:Record<string,number>;output:any;onAlternatives:(items:any[])=>void;onApply:(inputs:Record<string,number>)=>void};
export function EngineeringAlternativesPanel({calculator,entry,inputs,output,onAlternatives,onApply}:Props){
  const rows=listarResultadosTecnicos(output).filter(r=>typeof r.value==='number'&&Number.isFinite(r.value));
  const pathPrefix=output?.resultados?'resultados.':'';
  const [variable,setVariable]=React.useState(entry.fields[0]?.[0]||'');
  const start=Number(inputs[variable]||1);
  const [min,setMin]=React.useState(Math.max(0,start*.7));
  const [max,setMax]=React.useState(Math.max(1,start*1.3));
  const [objective,setObjective]=React.useState<'minimo'|'maximo'>('minimo');
  const [path,setPath]=React.useState(pathPrefix+(rows[0]?.path||''));
  const [operator,setOperator]=React.useState<'<='|'>='>('<=');
  const [limit,setLimit]=React.useState(Number(rows[0]?.value||0));
  const [extra,setExtra]=React.useState(false);
  const [path2,setPath2]=React.useState(pathPrefix+(rows[1]?.path||rows[0]?.path||''));
  const [operator2,setOperator2]=React.useState<'<='|'>='>('<=');
  const [limit2,setLimit2]=React.useState(Number(rows[1]?.value||0));
  const [manual,setManual]=React.useState(start);
  const [inverse,setInverse]=React.useState<any>(null);
  const [compare,setCompare]=React.useState<any[]>([]);
  const [error,setError]=React.useState('');
  const fields=entry.fields;
  const options=rows.map(row=>({value:pathPrefix+row.path,label:row.label+(row.unit?' ('+row.unit+')':'')}));
  const rules=():Constraint[]=>[
    {path,operator,limit},
    ...(extra?[{path:path2,operator:operator2,limit:limit2}]:[])
  ];
  const reset=()=>{setInverse(null);setCompare([]);setError('');onAlternatives([]);};
  const changeVariable=(value:string)=>{
    const v=Number(inputs[value]||1);
    setVariable(value);setMin(Math.max(0,v*.7));setMax(Math.max(1,v*1.3));
    setManual(v);reset();
  };
  const runInverse=()=>{
    try{
      const r=buscarDimensionamentoInverso({
        definition:entry,calculatorId:calculator,inputs,variableKey:variable,min,max,
        constraints:rules(),objetivo:objective
      });
      setInverse(r);setError('');setCompare([]);onAlternatives([]);
    }catch(e:any){setError(e.message);setInverse(null);}
  };
  const runCompare=()=>{
    try{
      const scenarios=[{nome:'Situação inicial',ajustes:{}},
        ...(inverse?.candidato?[{nome:'Candidato do dimensionamento inverso',ajustes:{[variable]:inverse.candidato.x}}]:[]),
        {nome:'Alternativa manual',ajustes:{[variable]:manual}}];
      const result=compararAlternativas({
        definition:entry,calculatorId:calculator,inputs,scenarios,constraints:rules()
      });
      setCompare(result);onAlternatives(result);setError('');
    }catch(e:any){setError(e.message);setCompare([]);onAlternatives([]);}
  };
  return <section className="cbim-math-assisted" aria-label="Engenharia assistida com restrições">
    <h3>Dimensionamento inverso e comparação de alternativas</h3>
    <p className="studio-muted">O motor original calcula cada cenário. A busca amostra 41 pontos e refina fronteiras: encontra candidatos matematicamente viáveis, sem garantir o ótimo global ou homologação por norma.</p>
    {!rows.length?<p>Não há grandezas de saída numéricas para comparar.</p>:<>
      <div className="cbim-react-form-grid">
        <label>Parâmetro a dimensionar<select value={variable} onChange={e=>changeVariable(e.target.value)}>{fields.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Objetivo<select value={objective} onChange={e=>{setObjective(e.target.value as any);reset();}}><option value="minimo">Menor valor viável</option><option value="maximo">Maior valor viável</option></select></label>
        <label>Limite mínimo<input type="number" step="any" value={min} onChange={e=>{setMin(Number(e.target.value));reset();}}/></label>
        <label>Limite máximo<input type="number" step="any" value={max} onChange={e=>{setMax(Number(e.target.value));reset();}}/></label>
        <label>Grandeza controlada<select value={path} onChange={e=>{const found=rows.find(row=>pathPrefix+row.path===e.target.value);setPath(e.target.value);if(found)setLimit(Number(found.value));reset();}}>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
        <label>Condição<select value={operator} onChange={e=>{setOperator(e.target.value as any);reset();}}><option value="<=">Menor ou igual a</option><option value=">=">Maior ou igual a</option></select></label>
        <label>Limite da grandeza<input type="number" step="any" value={limit} onChange={e=>{setLimit(Number(e.target.value));reset();}}/></label>
        <label className="cbim-assisted-check"><input type="checkbox" checked={extra} onChange={e=>{setExtra(e.target.checked);reset();}}/> Segunda restrição</label>
        {extra&&<>
          <label>Outra grandeza<select value={path2} onChange={e=>{setPath2(e.target.value);reset();}}>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
          <label>Condição<select value={operator2} onChange={e=>{setOperator2(e.target.value as any);reset();}}><option value="<=">Menor ou igual a</option><option value=">=">Maior ou igual a</option></select></label>
          <label>Segundo limite<input type="number" step="any" value={limit2} onChange={e=>{setLimit2(Number(e.target.value));reset();}}/></label>
        </>}
      </div>
      <div className="cbim-react-toolbar">
        <button type="button" onClick={runInverse}>Buscar candidato viável</button>
        <label>Valor da alternativa manual<input type="number" step="any" value={manual} onChange={e=>{setManual(Number(e.target.value));setCompare([]);onAlternatives([]);}}/></label>
        <button type="button" onClick={runCompare}>Comparar cenários</button>
      </div>
      {error&&<p className="cbim-react-error" role="alert">{error}</p>}
      {inverse&&<section className="cbim-assisted-feedback" aria-live="polite">
        <h4>{inverse.status==='viavel_amostrado'?'Candidato encontrado':'Nenhuma alternativa viável localizada na amostragem'}</h4>
        {inverse.candidato&&<p><strong>{fields.find(f=>f[0]===variable)?.[1}:</strong> {formatarValorTecnico(inverse.candidato.x)} · verificações matemáticas parciais atendidas</p>}
        <p className="studio-muted">{inverse.metodo}</p>
        {inverse.candidato&&<button type="button" onClick={()=>onApply(inverse.candidato.entradas)}>Carregar candidato no formulário para recalcular</button>}
        <EngineeringPlot title="Variação da grandeza principal" points={inverse.amostras.map((s:any)=>({
          x:s.x,y:s.resultados?(path.split('.').reduce((v:any,k:string)=>v?.[k],s.resultados)??null):null
        }))}/>
      </section>}
      {compare.length>0&&<div className="cbim-math-table" role="region" aria-label="Comparativo de soluções">
        <table><thead><tr><th>Cenário</th><th>{fields.find(f=>f[0]===variable)?.[1]}</th><th>Restrições</th><th>Verificação</th><th>Ações</th></tr></thead>
        <tbody>{compare.map(item=><tr key={item.id}>
          <td>{item.nome}</td><td>{formatarValorTecnico(item.entradas[variable])}</td>
          <td>{item.avaliacao.viavel?'Atende aos limites matemáticos':'Não atende / indisponível'}</td>
          <td>{item.verificacao.ok?'Parcial aprovada':'Rejeitada'}</td>
          <td><button type="button" onClick={()=>onApply(item.entradas)}>Carregar no formulário</button></td>
        </tr>)}</tbody></table>
        <p className="studio-muted">Comparação apenas matemática; não aprova projeto, altera IFC, resolve conflito ou atualiza orçamento.</p>
      </div>}
    </>}
  </section>;
}
