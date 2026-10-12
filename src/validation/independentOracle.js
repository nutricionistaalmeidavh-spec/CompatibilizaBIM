/*
 * Independent software-reference checks, NOT a structural design certificate.
 * Each calculator has a dedicated equation or dimensional conservation invariant.
 * Fail closed for unknown calculators, nonfinite input, absent or tampered outputs.
 */
const n=(a,k)=>Number(a[k]);
const r=(out,key)=>key.split('.').reduce((o,k)=>o?.[k],out);
const eq=(field,expected)=>({campo:field,esperado:expected});
const q=(o,k)=>Number(o?.resultados?.[k]);
const norm='Conferir combinação de ações, NBR aplicável, condições de contorno e responsabilidade técnica.';
const checks={
 vigaBiapoiada:(i)=>[eq('esforcos.momento',1.4*(n(i,'cargaPermanenteKNM')+n(i,'cargaAcidentalKNM'))*n(i,'vaoM')**2/8)],
 vigaFlexao:(i)=>[eq('resultados.d',n(i,'alturaCM')-n(i,'cobrimentoCM')),eq('resultados.md',n(i,'momentoKNM'))],
 lajeUmaDirecao:(i)=>[eq('resultados.md',1.4*(n(i,'cargaPermanenteKNM2')+n(i,'cargaAcidentalKNM2'))*n(i,'vaoM')**2/8)],
 lajeDuasDirecoes:(i)=>[eq('resultados.lambda',n(i,'vaoMaiorM')/n(i,'vaoMenorM'))],
 pilar:(i)=>[eq('resultados.areaCM2',n(i,'menorDimensaoCM')*n(i,'maiorDimensaoCM'))],
 sapata:(i)=>[eq('resultados.areaNecessaria',n(i,'cargaCaracteristicaKN')/n(i,'tensaoAdmissivelKPa'))],
 escada:(i)=>[eq('resultados.pd',1.4*(n(i,'cargaPermanenteKNM2')+n(i,'cargaAcidentalKNM2')))],
 muroArrimo:(i)=>[eq('resultados.h1',n(i,'alturaTotalM')-n(i,'alturaBaseM'))],
 insumosConcreto:(_i,o)=>[eq('resultados.cimentoSacos50Kg',Math.ceil(q(o,'cimentoTotalKg')/50)),
   eq('resultados.areiaTotalM3Estimado',q(o,'areiaTotalKg')/1450)],
 baciaDetencao:(i)=>[eq('resultados.vazaoPicoM3S',n(i,'coeficienteEscoamento')*n(i,'intensidadeMMH')*n(i,'areaHa')/360)],
 blocoDuasEstacas:(_i,o)=>[eq('resultados.reacao',q(o,'nd')/2)],
 bombaCentrifuga:(i)=>[eq('resultados.alturaManometricaM',n(i,'alturaRecalqueM')+n(i,'alturaSuccaoM')+n(i,'perdaSuccaoM')+n(i,'perdaRecalqueM'))],
 calhasCondutores:(i)=>[eq('resultados.vazaoProjetoLMin',n(i,'areaM2')*n(i,'intensidadeMMH')/60)],
 capacidadeEstaca:(i)=>[eq('resultados.areaPontaM2',Math.PI*(n(i,'diametroCM')/200)**2)],
 curvaIdf:(i)=>[eq('resultados.intensidadeMMH',n(i,'a')*n(i,'tempoRetornoAnos')**n(i,'b')/(n(i,'duracaoMin')+n(i,'c'))**n(i,'d'))],
 lajeNervurada:(i)=>[eq('resultados.alturaUtilCM',n(i,'alturaCM')-Number(i.cobrimentoCM??3))],
 ligacaoParafusada:(i)=>[eq('resultados.areaParafusoCM2',Math.PI*(n(i,'diametroMM')/20)**2)],
 orcamentoCronograma:(i)=>[eq('resultados.totalObra',i.etapas.reduce((v,x)=>v+Number(x.valor),0))],
 pilarMetalico:(i)=>[eq('resultados.comprimentoFlambagemM',n(i,'k')*n(i,'comprimentoM'))],
 redeEsgoto:(i)=>[eq('resultados.vazaoMediaLS',n(i,'populacao')*n(i,'consumoLHabDia')*n(i,'coefRetorno')/86400)],
 reservatorio:(i)=>[eq('resultados.consumoDiarioL',n(i,'populacao')*n(i,'consumoLHabDia'))],
 sarjetaBocaLobo:(i)=>[eq('resultados.laminaM',n(i,'larguraEspraiamentoM')*n(i,'declividadeTransversalPct')/100)],
 tubulacaoAguaFria:(i)=>[eq('resultados.comprimentoTotalM',n(i,'comprimentoRealM')+n(i,'comprimentoEquivalenteM'))],
 vigaMetalica:(i)=>[eq('resultados.momentoKNM',1.4*(n(i,'cargaPermanenteKNM')+n(i,'cargaAcidentalKNM'))*n(i,'vaoM')**2/8)],
 pilarAvancado:(i)=>[eq('resultados.areaM2',n(i,'larguraCM')*n(i,'alturaCM')/10000)],
 fundacaoIntegrada:(i)=>[eq('resultados.tensaoMedia',n(i,'cargaVertical')/n(i,'areaBase'))],
 detalhamentoArmadura:(i)=>[eq('resultados.comprimentoTotal',n(i,'comprimento')*n(i,'quantidadeBarras'))],
 listaAco:(i)=>[eq('resultados.0.comprimentoTotalM',n(i,'quantidade')*n(i,'comprimentoM'))],
 quadroFormas:(i)=>[eq('resultados.0.volumeM3',n(i,'comprimento')*n(i,'largura')*n(i,'altura'))],
 paredeConcreto:(i)=>[eq('resultados.volume',n(i,'comprimento')*n(i,'altura')*n(i,'espessura'))],
 protensao:(i)=>[eq('resultados.forcaEfetiva',n(i,'areaCabo')*n(i,'tensaoInicial')*(1-n(i,'perdasPercentual')/100))],
 alvenariaEstrutural:(i)=>[eq('resultados.areaResistente',n(i,'comprimento')*n(i,'espessura'))],
 elementoPremoldado:(i)=>[eq('resultados.volume',n(i,'comprimento')*n(i,'largura')*n(i,'altura'))],
 ancoragem:(i)=>[eq('resultados.capacidadeKN',n(i,'areaAcoMm2')*n(i,'resistenciaAcoMPa')/1000/n(i,'coeficienteSeguranca'))]
};
export function listarCoberturaOraculos(){return Object.keys(checks);}
function scan(value,where,errors){
 if(typeof value==='number'&&!Number.isFinite(value))errors.push(where+' não é finito');
 if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))scan(v,where+'.'+k,errors);
}
function approximate(a,b){
 return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1e-7,Math.abs(b)*1e-7);
}
export function validarCalculoIndependente(tipo,entrada,resultado){
 const errors=[];
 if(!entrada||!resultado||typeof entrada!=='object'||typeof resultado!=='object')errors.push('Entradas ou resultados ausentes');
 scan(entrada,'entrada',errors);scan(resultado,'resultado',errors);
 const verify=checks[tipo];
 if(!verify)errors.push('Calculadora sem oráculo independente: '+tipo);
 let verificacoes=[];
 if(verify&&!errors.length){
  try{
   verificacoes=verify(entrada,resultado);
   if(!verificacoes.length)errors.push('Oráculo sem regras para '+tipo);
   for(const {campo,esperado} of verificacoes){
    const obtido=r(resultado,campo);
    if(typeof obtido!=='number'||!approximate(obtido,esperado))
      errors.push('Divergência '+campo+': esperado '+esperado+', recebido '+obtido);
   }
  }catch(e){errors.push('Falha do oráculo '+tipo+': '+e.message);}
 }
 const norma=resultado?.metadados?.normaDeclarada||null;
 const normaPendente=!norma||/NBR 6118:2014|NBR 8800:2008/.test(norma);
 return {ok:errors.length===0,errors,verificacoes,metodo:'equação/dimensão independente por calculadora',
   normaDeclarada:norma,normaPendente,nivel:'verificacao_matematica_parcial',
   avisos:[normaPendente?'Perfil normativo ausente, legado ou não reconciliado.':'Perfil normativo declarado, exigir conferência de edição e premissas.',norm],
   validadoEm:new Date().toISOString()};
}
