# CBIM Library Entregas 16–20 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** entregar as Entregas 16–20 como pacote cumulativo Learning Ready para Revit 2027.

**Architecture:** contratos compartilhados para manifest/bridge; plugin Revit local e somente leitura remota; Publisher administrativo separado; aprendizado por arquivos JSONL auditáveis.

**Tech Stack:** C# 14, .NET 10, WPF, Autodesk Revit API 2027, JSON/JSONL, SHA-256, RSA.

**Spec:** `docs/superpowers/specs/2026-08-21-cbim-library-entregas-16-20-design.md`

## Global Constraints
- Revit 2027 e SDK .NET 10.0.100.
- Nenhuma primitiva de upload no cliente.
- Chave privada somente Publisher.
- Biblioteca pessoal preservada em update/uninstall.
- Bridge local antes de qualquer treinamento automático.

### Task 1: Library Intelligence
- [x] Estender `LibraryItem` com metadados, qualidade, tipos, parâmetros e quantitativos.
- [x] Criar `MetadataEnrichmentService` e `CatalogSearchService`.
- [x] Adicionar inspeção RFA via `ExternalEvent` e `FamilyManager`.
- [x] Carregar tipos específicos com `LoadFamilySymbol`.

### Task 2: Distribuição / Publisher
- [x] Criar `CBIM.Library.Contracts` e manifest v2.
- [x] Implementar atualização diferencial com SHA-256 e reuse local.
- [x] Implementar stable/preview, assinatura RSA opcional e staging report.
- [x] Implementar rollback por pacote.

### Task 3: Project Intelligence
- [x] Implementar Smart Insert.
- [x] Implementar substituição de FamilyInstance compatível.
- [x] Implementar Project Kits.
- [x] Implementar importação de padrões de RVT.

### Task 4: Diagnóstico / quantitativos
- [x] Implementar índice incremental.
- [x] Adicionar biblioteca corporativa read-only.
- [x] Gerar diagnóstico HTML.
- [x] Adicionar classificação override + SINAPI/unidade/descrição.

### Task 5: CBIM Learning Bridge
- [x] Exportar vocabulário e catálogo quantitativo.
- [x] Registrar observações após ações Revit bem-sucedidas.
- [x] Importar feedback JSONL e aplicar aliases/boosts.
- [x] Documentar contrato Bridge Inbox/Outbox.

### Verification
- [x] Validar XML/JSON/JSONL.
- [x] Fazer scan estrutural C#.
- [x] Confirmar ausência de primitivas remotas de escrita no cliente.
- [x] Confirmar presença dos contratos das Entregas 16–20.
- [ ] Compilar no Windows com Revit 2027 e SDK .NET 10.0.100.
- [ ] Executar testes funcionais dentro do Revit 2027.
