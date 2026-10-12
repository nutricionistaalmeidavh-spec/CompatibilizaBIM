# F7 + F8 — Operação de obras e confiança técnica dos cálculos

## F7 — Gestão de obras
- **RDO**: formulário React com equipes, serviços, recebimentos, ocorrências, impedimentos, fotos e aprovação. JPEG/PNG/WebP de até 4 MiB por foto e 16 MiB no total são armazenados no SQLite local. A versão em PDF usa o gerador offline, reconverte imagens para JPEG com Canvas e **inclui páginas visuais**. Links de fotos legadas externas continuam referenciados, sem simular anexos disponíveis.
- **Aprovação**: RDO aprovado permanece imutável; exclusão, edição e reaprovação são recusadas. Uma correção exige novo RDO identificando a origem. Medição aprovada não pode voltar a rascunho; responsável obrigatório e evento persistido no histórico.
- **Obra**: frente, subfrente, checklist, pedidos de compras/recebimentos, contratos/aditivos, orçamento e medições usam as tabelas SQLite existentes. Recusa recebimentos inválidos; os formulários não são limpos em erro.
- **Financeiro**: painel por obra distingue compromissos de compra, contratos, medido aprovado, despesas pagas, receitas confirmadas e recebidas; lançamentos globais sem obra não são alocados arbitrariamente. Não é conciliação bancária nem DRE contábil homologado.

## F8 — Biblioteca de 34 verificações matemáticas
- Cada uma das 34 calculadoras presentes no catálogo React agora possui oráculo explícito de referência, em `src/validation/independentOracle.js`, com conservação dimensional/equações para ao menos uma grandeza por calculadora, rejeição de NaN/Infinity e falha fechada para tipos não conhecidos.
- Regressão executa todas as 34 com entradas padrão e altera deliberadamente a grandeza checada, exigindo falha do validador. Relatórios preservam entradas, saída, equação auditada, avisos e norma declarada.
- O indicador correto é **verificação matemática parcial**, não conformidade normativa. A conferência global das NBR em todos os estados limites, combinações, coeficientes, parâmetros locais e condições de contorno requer análise de cláusulas e homologação profissional específica.
- A ABNT lista `NBR 6118:2026`; a `NBR 8800:2024` possui versão corrigida de 2025. Os perfis herdados de NBR 6118:2014/8800:2008 permanecem marcados para reconciliação normativa. O Studio bloqueia confiança automática em resultados numéricos divergentes, mas não declara aprovação normativa.

## Critérios automatizados
- Node `npm test`, testes parametrizados F8, proteção contra alterações inválidas F7, PDF com fotos, regressão SQLite/migrações e cálculos estruturais existentes.
- Build Vite React e Playwright na aplicação única; runtime Windows, instalador NSIS e conversão DWG/IFC original continuam nos gates existentes.
- CI acionado apenas por `run-cbim-qa`; nenhuma instalação no computador do usuário.
