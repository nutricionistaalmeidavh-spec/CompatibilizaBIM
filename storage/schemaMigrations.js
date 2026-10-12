// In-place, transaction-protected schema evolution for databases created before Studio.
// This operates on SQL.js memory and never commits a partial migration to disk.
const additions = [
  ['rdos','status_aprovacao',"TEXT NOT NULL DEFAULT 'rascunho'"],
  ['rdos','aprovado_por','TEXT'],
  ['rdos','aprovado_em','TEXT'],
  ['bim_modelos','arquivo_base64','TEXT'],
  ['nos_estruturais','z','REAL NOT NULL DEFAULT 0'],
  ['nos_estruturais','apoio_uz','INTEGER NOT NULL DEFAULT 0'],
  ['nos_estruturais','apoio_rx','INTEGER NOT NULL DEFAULT 0'],
  ['nos_estruturais','apoio_ry','INTEGER NOT NULL DEFAULT 0'],
  ['nos_estruturais','carga_fz','REAL NOT NULL DEFAULT 0'],
  ['nos_estruturais','carga_mx','REAL NOT NULL DEFAULT 0'],
  ['nos_estruturais','carga_my','REAL NOT NULL DEFAULT 0'],
  ['workspace_context','projeto_bim_id','TEXT REFERENCES bim_projetos(id) ON DELETE SET NULL'],
  ['bim_analises_avulsas','modelos_json',"TEXT NOT NULL DEFAULT '[]'"],
  ['bim_analises_avulsas','proveniencia',"TEXT NOT NULL DEFAULT 'desconhecida'"]
];
export const CURRENT_SCHEMA_VERSION = 4;
export function migrarBancoCompatibilidade(db, schemaSql) {
  const version = db.exec('PRAGMA user_version')?.[0]?.values?.[0]?.[0] ?? 0;
  if (version > CURRENT_SCHEMA_VERSION) throw new Error('Este banco foi criado por uma versão mais recente do CompatibilizaBIM. Nenhuma alteração foi feita.');
  db.run('BEGIN TRANSACTION');
  try {
    db.run(schemaSql);
    for (const [table, column, definition] of additions) {
      const present = db.exec('PRAGMA table_info('+table+')')?.[0]?.values?.some(row=>row[1]===column);
      if (!present) db.run('ALTER TABLE '+table+' ADD COLUMN '+column+' '+definition);
    }
    const check = db.exec('PRAGMA integrity_check')?.[0]?.values?.[0]?.[0];
    if (check !== 'ok') throw new Error('Falha de integridade no SQLite após migração: '+check);
    db.run('PRAGMA user_version = '+CURRENT_SCHEMA_VERSION);
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
  return CURRENT_SCHEMA_VERSION;
}
