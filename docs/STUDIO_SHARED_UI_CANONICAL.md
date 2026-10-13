# UI canônica aplicada ao CompatibilizaBIM Studio React
Origem conceitual: \`frontEnds/library/{forms,tables,dialogs,feedback,navigation,motion}-kit\` e \`frontEnds/shells/product-runtime/smart-form.tsx\`.
O design foi adaptado ao CSS e aos contratos existentes; o app **não** importa segundo shell, router, backend nem Tailwind.

## Aplicação
- Campos por esquema com nomes de FormData idênticos aos existentes: criação de obra, frente, subfrente e checklist.
- Tabelas de registros reais (medições, orçamento e histórico de obra) com cabeçalhos, rolagem horizontal e estados vazios.
- Confirmação obrigatória para mudanças irreversíveis: RDO aprovado, exclusão de RDO (digitar EXCLUIR), medição aprovada/rejeitada e importação/restauração de backup (digitar RESTAURAR).
- Notificações de processamento e erro com \`role=status/alert\`, sem porcentagens fictícias.
- Breadcrumbs por rota/obra/estudo. Estudo independente nunca aparece falsamente dentro de uma obra.
- Transições curtas e respeito a \`prefers-reduced-motion\`.

## Invariantes
- Esquemas descrevem apresentação/nomes de campos, não persistência nem regras de negócio.
- SQLite e WorkspaceStore únicos; nenhum \`localStorage\` novo com registros de domínio.
- Operações críticas executadas **somente após** confirmação; cancelar não modifica dados.
- RDO aprovado é imutável e correção segue via novo RDO de retificação.
- Status de medição só muda após confirmação; erro mantém o status do registro original.
- Backup é pré-validado, confirmação detalha a omissão de arquivos DWG/IFC externos, importação usa \`importarBackup\` original.
- QA: \`node --test\` cobrindo especificações e wiring, \`vite build\`, fluxo React Playwright, exercício Windows/RDO antes de merge.
