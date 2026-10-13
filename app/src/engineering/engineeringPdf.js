import {gerarPdfRelatorio} from '../pdfTemplates.js';
import {listarResultadosTecnicos,formatarValorTecnico} from '../../../src/engineering/mathPresentation.js';
import {estadoVinculoBim} from '../../../src/engineering/contextualStudies.js';
const text=(v)=>v===undefined||v===null||v===''?'não informado':String(v);
const kv=(label,value)=>label+': '+text(value);
const money=(n)=>n===null||n===undefined?'indisponível':
 new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n));
export function gerarMemoriaBimPdf({estudo,projeto,impactos=[]}={}){
 if(!estudo?.id||!estudo.contexto||estudo.projeto_id!==projeto?.id)throw Error('Memória BIM não corresponde ao projeto.');
 const context=estudo.contexto,verification=estadoVinculoBim(context,projeto);
 const norma=estudo.resultados?.metadados?.normaDeclarada||'Não declarada';
 const rows=listarResultadosTecnicos(estudo.resultados).filter(x=>!x.path.startsWith('entrada.')).slice(0,28);
 const input=Object.entries(estudo.entradas||{}).slice(0,18).map(([k,v])=>kv(k,typeof v==='object'?JSON.stringify(v).slice(0,160):v));
 const checks=estudo.validacao||{};
 const sections={
   'Identificação':[
      kv('Registro imutável',estudo.id),kv('Título',estudo.titulo),
      kv('Calculadora',estudo.calculadora_tipo),kv('Criado em',estudo.criado_em),
      kv('Estudo BIM',projeto.nome+' ('+projeto.id+')'),
      kv('Estado técnico','preliminar; revisão responsável obrigatória'),
      kv('Origem atual',verification.atual?'conferida':'alterada - '+verification.motivo)
   ],
   'Rastreabilidade do modelo':[
      kv('Modelo',context.modeloId),kv('IFC origem',projeto.modelos?.find(m=>m.id===context.modeloId)?.arquivo_nome),
      kv('Revisão',context.revisao),kv('Hash original',context.arquivoHash),
      kv('GUID',context.elementoRef),kv('Análise BIM',context.analiseId),
      kv('Pendência',context.conflitoChave),kv('Assinatura geométrica',context.elementosAssinatura)
   ],
   'Parâmetros':input.length?input:['Não existem entradas escalares registradas.'],
   'Resultados técnicos':rows.map(row=>kv(row.path,formatarValorTecnico(row.value)+(row.unit?' '+row.unit:''))),
   'Conferências e hipóteses':[
      kv('Oráculo matemático',checks.ok?'verificação parcial aprovada':'não aprovado'),
      kv('Método',checks.metodo),kv('Verificações independentes',checks.verificacoes?.length??0),
      kv('Norma declarada',norma),kv('Nota de engenharia',estudo.nota),
      ...((checks.avisos||[]).slice(0,6).map(v=>'Aviso: '+v)),
      kv('Cenários matemáticos registrados',estudo.alternativas?.length||0)
   ],
 };
 const list=Array.isArray(impactos)?impactos:[];

 if(list.length){
   list.slice(0,20).forEach((entry,index)=>{
     const imp=entry.snapshot||entry;
     sections['Simulação 5D '+(index+1)]=[
      kv('Registro de impacto',entry.id||'sem ID'),
      kv('GUID QTO',imp.qtoFonte?.guid),kv('Fonte QTO',imp.qtoFonte?.arquivo),kv('SHA-256 QTO/IFC',imp.qtoFonte?.sha256),
      kv('Grandeza',imp.qtoFonte?.quantidade),
      kv('Quantidade anterior',formatarValorTecnico(imp.quantidadeOriginal)+' '+text(imp.unidade)),
      kv('Quantidade proposta',formatarValorTecnico(imp.quantidadeProposta)+' '+text(imp.unidade)),
      kv('Variação',formatarValorTecnico(imp.diferencaQuantidade)+' '+text(imp.unidade)),
      kv('Composição',imp.precoReferencia?.composicao||'Não precificada'),
      kv('Fonte e competência',imp.precoReferencia?imp.precoReferencia.fonte+' / '+imp.precoReferencia.competencia:'Ausentes'),
      kv('Custo delta',money(imp.custoDelta)),
      kv('Hipótese',imp.hipotese||'Não informada')
     ];
   });
   if(list.length>20)sections['Limite do documento']=[list.length+' simulações registradas; PDF contém as 20 mais recentes. Consulte o SQLite para o histórico completo.'];
 }else sections['Quantitativos 5D']=['Nenhuma simulação 5D registrada neste estudo. Custo não presumido.'];
 sections['Responsabilidade técnica']=[
  'Documento preliminar e rastreável. Não constitui projeto executivo ou aprovação normativa.',
  'Custo diferencial não atualiza orçamento, medição, pagamento, IFC, BCF ou pendência.',
  'Verifique revisão do modelo, QTO IFC, unidade, composição, preços, BDI e hipóteses com o responsável técnico.'
 ];
 return gerarPdfRelatorio('Memória BIM · '+String(estudo.titulo).slice(0,52),sections);
}
