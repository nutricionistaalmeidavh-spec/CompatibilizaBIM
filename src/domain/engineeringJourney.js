// Navegação por referências canônicas: nenhuma gravação financeira ou física.
const routes=new Set(['BIM','Operação','RDO','Financeiro']);
const kinds=new Set(['bim-conciliacao','medicao','rdo-competencia','rdo','contas-competencia','lancamento','financeiro-resumo']);
export function createEngineeringTarget(route,data={}){
 if(!routes.has(route))throw Error('Módulo de destino inválido.');
 const kind=String(data.kind||'');
 if(!kinds.has(kind))throw Error('Tipo de referência inválido.');
 const normalized={kind,obraId:String(data.obraId||''),studyId:String(data.studyId||''),id:String(data.id||''),period:String(data.period||'')};
 if(['medicao','rdo','lancamento','bim-conciliacao'].includes(kind)&&!normalized.id)throw Error('Identificador de origem obrigatório.');
 if(['rdo-competencia','contas-competencia'].includes(kind)&&!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(normalized.period))throw Error('Competência inválida.');
 if(kind==='medicao'&&route!=='Operação'||kind==='bim-conciliacao'&&route!=='BIM'||['rdo','rdo-competencia'].includes(kind)&&route!=='RDO'||['lancamento','contas-competencia','financeiro-resumo'].includes(kind)&&route!=='Financeiro')throw Error('Referência incompatível com o módulo.');
 return normalized;
}
export function resolveSourceRecord(allRows=[],scopedRows=[],id=''){
 const record=allRows.find(row=>row.id===id)||null;
 return {record,outsideScope:!!record&&!scopedRows.some(row=>row.id===id)};
}
export function filterRdosByCompetence(rows=[],period=''){
 if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(String(period)))return [];
 return rows.filter(row=>String(row.data||'').slice(0,7)===period);
}
export function filterEntriesByDueCompetence(rows=[],period=''){
 if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(String(period)))return [];
 return rows.filter(row=>String(row.vencimento||'').slice(0,7)===period);
}
export function quantityVarianceMessage(value,unit=''){
 if(value===null||value===undefined||!Number.isFinite(Number(value)))return 'Comparação indisponível até validar a referência operacional.';
 const diff=Number(value);
 if(Math.abs(diff)<=1e-7)return 'Sem diferença quantitativa na competência e unidade conferidas.';
 const formatted=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:5}).format(Math.abs(diff));
 return 'Diferença: BIM '+(diff>0?'acima':'abaixo')+' da medição operacional em '+formatted+' '+String(unit||'unidade não declarada')+'. Não é valor financeiro.';
}
