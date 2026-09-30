# CBIM Library Entregas 16–20 — Design

## Objetivo
Evoluir a Library de gerenciador de arquivos para catálogo técnico inteligente e preparar uma interface local, auditável e reversível para aprendizagem com o CBIM Core.

## Invariantes
- Revit 2027 / .NET 10.
- Cliente não possui upload ou credencial de escrita do repositório oficial.
- `My Library` nunca é alterada por atualizações oficiais.
- Feedback/aprendizagem é local por padrão e pode ser desligado.
- A chave privada de assinatura existe apenas no Publisher.
- Nenhum modelo ML é treinado automaticamente antes da fase de validação dos sinais.

## Arquitetura
`CBIM.Library.Contracts` contém contratos de manifest e bridge compartilhados. O plugin Revit gerencia acervo local, busca, inspeção Revit e eventos de uso. O Publisher cria releases, relatórios de staging e assinatura. A ponte com CBIM é baseada em JSON/JSONL em `Bridge/Inbox` e `Bridge/Outbox`, evitando acoplamento binário entre os produtos.

## Fluxo de aprendizagem
1. Library exporta vocabulário técnico por SHA-256.
2. Usuário pesquisa e escolhe componente.
3. Operações bem-sucedidas ou `✓ Correto` geram observação.
4. CBIM Core consome vocabulário/observações e devolve feedback referenciando SHA-256.
5. Library aplica aliases/boosts; a fase seguinte poderá calibrar ranking/modelos com dataset auditável.
