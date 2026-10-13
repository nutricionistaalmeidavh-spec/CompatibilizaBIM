import {estadoVinculoBim} from './contextualStudies.js';

const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
const norm=(x)=>String(x??'').trim().toLocaleLowerCase('pt-BR');
const eq=(a,b)=>norm(a)===norm(b);
const quantKey=(r)=>[r.source_file,r.global_id,r.kind,r.quantity_name,r.unit].map(v=>String(v??'')).join('|');
const WARNING='Simulação preliminar. Não altera IFC, quantitativos oficiais, orçamento 5D, medição, pagamento ou decisão de conflito.';
const modelFor=(estudo,projeto)=>{
 if(!estudo?.id||!projeto||estudo.projeto_id!==projeto.id)throw Error('Estudo não pertence ao projeto BIM informado.');
 const model=(projeto.modelos||[]).find(m=>m.id===estudo.modelo_id||m.id===estudo.contexto?.modeloId);
 if(!model)throw Error('Modelo BIM de origem não encontrado.');
 const review=estadoVinculoBim(estudo.contexto,projeto);
 if(!review.atual)throw Error('Revisão BIM alterada ou indisponível: '+review.motivo);
 if(!estudo.contexto?.elementoRef)throw Error('Memória sem GUID de elemento: selecione um elemento BIM antes de vincular QTO.');
 return model;
};
export function listarQuantitativosDaMemoria({estudo,projeto,quantidades}={}){
 const model=modelFor(estudo,projeto);
 if(!quantidades||!Array.isArray(quantidades.records))return {itens:[],revisaoConferidaAutomaticamente:false,motivo:'Relatório QTO IFC não disponível.'};
 const filename=model.arquivo_nome||model.nome;
 if(!String(filename||'').toLowerCase().endsWith('.ifc'))return {itens:[],revisaoConferidaAutomaticamente:false,motivo:'Quantitativos IFC requerem arquivo IFC original, não manifesto JSON.'};
 if(!Array.isArray(quantidades.models)||!quantidades.models.some(m=>eq(m,filename)))return {itens:[],revisaoConferidaAutomaticamente:false,motivo:'O arquivo de origem não está listado no QTO do motor.'};
 const matching=quantidades.records.filter(r=>r&&r.source==='ifc_qto'&&
    r.global_id===estudo.contexto.elementoRef&&eq(r.source_file,filename)&&
    finite(r.value)&&r.value>=0&&String(r.unit||'').trim()&&String(r.quantity_name||'').trim());
 const keys=new Set();
 const itens=matching.filter(row=>{
   const k=quantKey(row);if(keys.has(k))return false;keys.add(k);return true;
 }).map(row=>({...row,itemKey:quantKey(row)}));
 return {itens,revisaoConferidaAutomaticamente:false,
   motivo:'O QTO confirma arquivo e GUID, mas não inclui hash da revisão; confirme explicitamente a revisão antes de simular.',
   arquivoNome:filename,hashOriginal:estudo.contexto.arquivoHash||null};
}
const priceMatch=(q,line)=>[
 ['unit','unit'],['discipline','discipline'],['storey','storey'],
 ['ifc_class','ifc_class'],['type_name','type_name'],['quantity_name','quantity_name']
].every(([k,l])=>eq(q[k],line[l]));
export function simularImpacto5D({estudo,projeto,quantidades,orcamento,itemKey,quantidadeProposta,confirmacaoRevisao=false,hipotese=''}={}){
 const {itens}=listarQuantitativosDaMemoria({estudo,projeto,quantidades});
 if(!confirmacaoRevisao)throw Error('Confirme que os quantitativos correspondem à revisão IFC selecionada.');
 const matches=itens.filter(q=>q.itemKey===itemKey);
 if(matches.length!==1)throw Error('Quantitativo IFC não encontrado ou ambíguo para este GUID e arquivo.');
 if(!finite(quantidadeProposta)||quantidadeProposta<0||quantidadeProposta>1e9)throw Error('Informe quantidade proposta finita, não negativa e na unidade original do QTO.');
 const q=matches[0],delta=quantidadeProposta-q.value;
 const lines=Array.isArray(orcamento?.lines)?orcamento.lines.filter(row=>priceMatch(q,row)):[];
 // The 5D budget is grouped. Never allocate its overall total to a single element.
 const candidates=lines.filter(row=>finite(row.final_unit_cost)&&row.final_unit_cost>=0);
 const validCurrency=orcamento?.currency==='BRL'&&String(orcamento?.source||'').trim()&&String(orcamento?.reference_date||'').trim();
 const status=!validCurrency||(!lines.length)?'sem_preco':lines.length!==1||candidates.length!==1?'mapeamento_ambiguo':'precificado';
 const priced=status==='precificado',line=priced?candidates[0]:null;
 const custoDelta=priced?Number((delta*line.final_unit_cost).toFixed(2)):null;
 return {
  schemaVersion:1,status,
  contexto:{estudoId:estudo.id,projetoId:projeto.id,modeloId:estudo.contexto.modeloId,
    revisao:estudo.contexto.revisao,arquivoHash:estudo.contexto.arquivoHash||null,
    arquivoNome:q.source_file,elementoRef:q.global_id,analiseId:estudo.contexto.analiseId||null,
    conflitoChave:estudo.contexto.conflitoChave||null},
  qtoFonte:{arquivo:q.source_file,guid:q.global_id,classe:q.ifc_class,disciplina:q.discipline,
    pavimento:q.storey||null,quantidade:q.quantity_name,tipo:q.kind,fonte:q.source,
    geradoEm:quantidades.generated_at||null},
  itemKey:q.itemKey,quantidadeOriginal:q.value,quantidadeProposta,diferencaQuantidade:delta,unidade:q.unit,
  precoUnitario:priced?line.final_unit_cost:null,custoDelta,
  precoReferencia:priced?{composicao:line.composition_code,descricao:line.description,
    linha:line.line_id,fonte:orcamento.source,competencia:orcamento.reference_date,
    bdiPercent:orcamento.bdi_percent,relatorioEm:orcamento.generated_at||null}:null,
  orcamentoParcial:Boolean(orcamento?.unmatched_group_count>0),
  hipotese:String(hipotese??'').trim().slice(0,2000),
  confirmacaoRevisao:true,geradoEm:new Date().toISOString(),
  advertencias:[WARNING,'QTO com identidade GUID+arquivo; hash da revisão não é transmitido pelo motor de quantitativos.',
   priced?'Custo diferencial = variação de quantidade × preço unitário final do grupo 5D; não é orçamento executado.':
   status==='mapeamento_ambiguo'?'Várias composições compatíveis; nenhum custo calculado.':
   'Não existe composição local rastreável para este quantitativo; nenhum custo foi presumido.']
 };
}
