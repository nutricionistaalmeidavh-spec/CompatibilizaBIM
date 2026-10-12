// Contrato único de persistência da federação, reutilizável nos testes SQLite.
// O manifesto dos modelos e a proveniência fazem parte da evidência, não da UI.
export const INSERT_STUDY_ANALYSIS = `INSERT INTO bim_analises_avulsas
 (id,projeto_id,modelo_a_id,modelo_b_id,modo,tolerancia,afastamento,status,conflitos_json,modelos_json,proveniencia,criado_em)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
export function insertStudyAnalysis(db,projectId,data={},id,createdAt=new Date().toISOString()){
 const manifest=Array.isArray(data.modelos)?data.modelos:[];
 const engine=String(data.proveniencia||'desconhecida');
 db.run(INSERT_STUDY_ANALYSIS,[
  id,projectId,data.modeloAId??null,data.modeloBId??null,data.modo??'intersection',
  Number(data.tolerancia??0.002),Number(data.afastamento??0.05),data.status??'concluida',
  JSON.stringify(data.conflitos??[]),JSON.stringify(manifest),engine,createdAt
 ]);
 return id;
}
