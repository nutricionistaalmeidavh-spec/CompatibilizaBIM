import React from 'react';
import {listarQuantitativosDaMemoria,simularImpacto5D} from '../../../../src/engineering/p4Impact.js';
import {salvarImpactoEngenhariaBim,listarImpactosEngenhariaBim} from '../../../../storage/sqliteStore.js';
import {gerarMemoriaBimPdf} from '../../engineering/engineeringPdf.js';
import {estadoVinculoBim} from '../../../../src/engineering/contextualStudies.js';
import {formatarValorTecnico} from '../../../../src/engineering/mathPresentation.js';

type Props={db:any;estudo:any;projeto:any;onSaved?:()=>void};
const bridge=()=> (globalThis as any).engineeringStorage?.bim?.p2;
const reais=(n:number|null|undefined)=>n===null||n===undefined?'Sem preço verificado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
const file=(name:string,pdf:Blob)=>{
 const url=URL.createObjectURL(pdf);
 const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();
 setTimeout(()=>URL.revokeObjectURL(url),1600);
};
export function P4EngineeringPanel({db,estudo,projeto,onSaved}:Props){
 const [quant,setQuant]=React.useState<any>(null);
 const [budget,setBudget]=React.useState<any>(null);
 const [key,setKey]=React.useState('');
 const [newQuantity,setNewQuantity]=React.useState('');
 const [assumption,setAssumption]=React.useState('');
 const [confirmed,setConfirmed]=React.useState(false);
 const [preview,setPreview]=React.useState<any>(null);
 const [error,setError]=React.useState('');
 const [notice,setNotice]=React.useState('');
 const [busy,setBusy]=React.useState(false);
 const impacts=listarImpactosEngenhariaBim(db,estudo.id);
 const review=estadoVinculoBim(estudo.contexto,projeto);
 const selection=React.useMemo(()=>{
   if(!quant)return {itens:[],motivo:''};
   try{return listarQuantitativosDaMemoria({estudo,projeto,quantidades:quant});}
   catch(e:any){return {itens:[],motivo:e.message};}
 },[estudo,projeto,quant]);
 const selected=selection.itens.find((item:any)=>item.itemKey===key);
 const fetch5d=async()=>{
   setBusy(true);setError('');setNotice('');setPreview(null);
   try{
     const api=bridge();if(!api)throw Error('QTO e orçamento precisam do motor desktop 4D/5D.');
     const stat=await api({projectId:projeto.id,action:'status',params:{}});
     if(!stat.quantities)throw Error('Extraia os quantitativos IFC na etapa BIM → 4D/5D antes de realizar esta associação.');
     const q=await api({projectId:projeto.id,action:'quantity_records',params:{}});
     if(!Array.isArray(q?.records))throw Error('Motor 5D não retornou linhas QTO rastreáveis.');
     const cost=stat.budget?await api({projectId:projeto.id,action:'budget_report',params:{}}):null;
     setQuant(q);setBudget(cost);setKey('');setNewQuantity('');setConfirmed(false);
     setNotice(cost?'QTO e orçamento carregados do motor local.':'QTO carregado. Não há orçamento precificado; valores monetários permanecerão indisponíveis.');
   }catch(e:any){setError(e.message||String(e));setQuant(null);setBudget(null);}
   finally{setBusy(false);}
 };
 const calculate=()=>{
   setError('');setNotice('');
   try{
     if(!newQuantity.trim())throw Error('Informe a quantidade proposta na unidade original do QTO.');
     if(!assumption.trim())throw Error('Descreva a hipótese técnica que justifica a nova quantidade.');
     setPreview(simularImpacto5D({estudo,projeto,quantidades:quant,orcamento:budget,
       itemKey:key,quantidadeProposta:Number(newQuantity),confirmacaoRevisao:confirmed,hipotese:assumption}));
   }catch(e:any){setError(e.message||String(e));setPreview(null);}
 };
 const save=()=>{
   try{
     if(!preview)throw Error('Execute a simulação antes de registrá-la.');
     const id=salvarImpactoEngenhariaBim(db,{
       estudoId:estudo.id,projetoId:projeto.id,quantidades:quant,orcamento:budget,
       itemKey:key,quantidadeProposta:Number(newQuantity),confirmacaoRevisao:confirmed,hipotese:assumption
     });
     setNotice('Simulação 5D preliminar registrada, sem modificar orçamento ou medição. ID: '+id);
     setPreview(null);setError('');onSaved?.();
   }catch(e:any){setError(e.message||String(e));}
 };
 const pdf=()=>{
   try{
     const output=gerarMemoriaBimPdf({estudo,projeto,impactos});
     file('memoria-bim-'+estudo.id+'.pdf',output);
     setError('');
   }catch(e:any){setError(e.message||String(e));}
 };
 return <section className="cbim-p4-panel" aria-label="P4 Memória PDF e impacto 5D">
   <h4>Memória rastreável e impacto 5D</h4>
   <p className="studio-muted">O PDF reúne a evidência do cálculo, o vínculo ao modelo/revisão, as alternativas registradas e as simulações 5D. A fonte econômica é o orçamento local existente.</p>
   <div className="cbim-react-toolbar">
     <button type="button" onClick={pdf}>Exportar memória BIM PDF</button>
     <button type="button" disabled={busy||!review.atual||!bridge()||!estudo.elemento_ref} onClick={()=>void fetch5d()}>
       {busy?'Consultando QTO…':'Consultar QTO e orçamento 5D'}
     </button>
   </div>
   {!review.atual&&<p role="status">Referência antiga: {review.motivo}. A simulação nova fica bloqueada, mas o PDF do histórico permanece disponível.</p>}
   {!estudo.elemento_ref&&<p role="status">Para relacionar QTO automaticamente, salve uma nova memória com GUID do elemento IFC identificado. A memória original não será modificada.</p>}
   {!bridge()&&<p className="studio-muted">Prévia web: PDF disponível. Para custos e quantitativos, use o aplicativo desktop com o módulo 4D/5D.</p>}
   {quant&&<div className="cbim-p4-quantities">
     <p>{selection.itens.length} quantitativo(s) IFC verificável(is) para o GUID {estudo.elemento_ref||'—'}. {selection.motivo}</p>
     <div className="cbim-react-form-grid">
       <label>Grandeza IFC/QTO<select value={key} onChange={e=>{
         setKey(e.target.value);const item=selection.itens.find((x:any)=>x.itemKey===e.target.value);
         setNewQuantity(item?String(item.value):'');setPreview(null);setConfirmed(false);
       }}><option value="">Selecione</option>{selection.itens.map((item:any)=><option key={item.itemKey} value={item.itemKey}>
           {item.quantity_name} · {formatarValorTecnico(item.value)} {item.unit} · {item.storey||'sem pavimento'}
         </option>)}</select></label>
       <label>Quantidade proposta ({selected?.unit||'unidade do QTO'})<input type="number" min="0" step="any"
         value={newQuantity} disabled={!selected} onChange={e=>{setNewQuantity(e.target.value);setPreview(null);}}/></label>
     </div>
     {selected&&<p className="studio-muted">Origem: {selected.source_file} · {selected.global_id} · {selected.quantity_name} · {selected.source}. Base: {formatarValorTecnico(selected.value)} {selected.unit}.</p>}
     <label>Hipótese de revisão e justificativa<textarea value={assumption} maxLength={2000} rows={2}
       onChange={e=>{setAssumption(e.target.value);setPreview(null);}}
       placeholder="Explique como a nova quantidade foi derivada; a simulação não modifica a geometria"/></label>
     <label className="cbim-p4-attestation"><input type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);setPreview(null);}}/>
       Conferi que o QTO carregado corresponde ao IFC e à revisão {estudo.contexto.revisao} deste registro (o motor QTO não fornece o hash desta revisão).</label>
     <div className="cbim-react-toolbar">
       <button type="button" disabled={!selected||!confirmed||!assumption.trim()||!newQuantity.trim()} onClick={calculate}>Simular impacto preliminar</button>
     </div>
   </div>}
   {preview&&<div className="cbim-p4-preview" aria-live="polite">
     <p><strong>Diferença física:</strong> {formatarValorTecnico(preview.diferencaQuantidade)} {preview.unidade}</p>
     <p><strong>Impacto em custo:</strong> {reais(preview.custoDelta)}{preview.precoReferencia?' · composição '+preview.precoReferencia.composicao+' · competência '+preview.precoReferencia.competencia:''}</p>
     {preview.orcamentoParcial&&<p role="status">Orçamento 5D parcial: existem itens não precificados no estudo.</p>}
     <p className="studio-muted">{preview.advertencias.join(' ')}</p>
     <button type="button" onClick={save}>Registrar simulação no SQLite</button>
   </div>}
   {impacts.length>0&&<div className="cbim-math-table"><h4>Histórico de simulações 5D ({impacts.length})</h4>
     <table><thead><tr><th>Data</th><th>QTO</th><th>Variação</th><th>Impacto</th></tr></thead>
       <tbody>{impacts.slice(0,20).map((row:any)=><tr key={row.id}><td>{row.criado_em}</td>
         <td>{row.snapshot.qtoFonte?.quantidade} · {row.snapshot.contexto?.elementoRef}</td>
         <td>{formatarValorTecnico(row.snapshot.diferencaQuantidade)} {row.snapshot.unidade}</td>
         <td>{reais(row.snapshot.custoDelta)}</td></tr>)}</tbody>
     </table>
     <p className="studio-muted">Registros de avaliação: não são aditivos, revisões de preço, nem medições aprovadas.</p>
   </div>}
   {notice&&<p role="status">{notice}</p>}
   {error&&<p role="alert" className="cbim-react-error">{error}</p>}
 </section>;
}
