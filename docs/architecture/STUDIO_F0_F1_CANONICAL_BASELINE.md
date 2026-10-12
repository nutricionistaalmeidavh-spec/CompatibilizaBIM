# CompatibilizaBIM Studio — F0/F1 baseline e canonização

Status: implementado na branch `feat/p1-cbim-studio-commercial`.

## F0 — baseline protegido

### Stack atual preservado
- Electron: ciclo de vida desktop, filesystem e execução local.
- Vite: renderer/app existente.
- Studio legado: HTML/CSS/JS gerado por `product/studio.py`.
- CBIM Core/Python: conversão, reconhecimento, IFC e regras técnicas.
- Workspace local: `WorkspaceStore`, arquivos inspecionáveis e gravações atômicas.
- Recovery: `AutosaveManager`, snapshots e recuperação de sessão.
- Testes: `node --test` no repositório e `pytest` no core integrado.

### Fluxos de referência que não podem regredir
1. abertura do Electron/Studio;
2. criação/preparação do workspace;
3. importação DWG/DXF/IFC;
4. conversão e validação;
5. criação do CBIM canônico;
6. revisão de elementos;
7. undo/redo de sessão;
8. salvamento;
9. snapshots/histórico;
10. crash recovery;
11. restauração;
12. exportação CBIM/IFC/relatório.

O renderer HTML permanece como baseline funcional até a futura migração React atingir paridade.

## F1 — autoridade canônica

### Fonte de verdade
`project/project.cbim.json` validado como `CBIMProject` é a fonte autoritativa para projeto e elementos BIM.

`workspace.json` é a autoridade para metadados do workspace e número de revisão.

`import-plan.json` e `config.json` mantêm seus domínios próprios. Autosaves e `revisions/` são histórico/recuperação e nunca competem com o projeto corrente.

### Read model canônico
`product/canonical.py` produz `CanonicalProjectState` exclusivamente a partir de `CBIMProject + WorkspaceManifest.revision`.

O contrato contém:
- identidade do projeto;
- versão de schema;
- unidades e referência de coordenadas;
- revisão;
- elementos com IDs estáveis;
- tipo, pavimento, sistema, confiança;
- estado de revisão;
- referências de origem.

Ele deliberadamente NÃO contém seleção, filtros, aba aberta, painel expandido ou qualquer outro estado de renderer.

### Regra de escrita
Não existe segunda store e não existe mutation layer.

Fluxo de escrita:

```
UI -> comando/API local -> validação CBIMProject -> Autosave/Snapshot -> WorkspaceStore -> project.cbim.json
```

Fluxo de leitura para UI:

```
project.cbim.json + workspace.json -> CanonicalProjectState -> /api/canonical -> renderer
```

### IDs
IDs de projeto e elementos vêm do CBIM SDK e são preservados. A projeção canônica rejeita IDs de elemento duplicados.

### Estados de revisão
Único vocabulário canônico:
- `auto`
- `confirmed`
- `edited`
- `rejected`

Telas, métricas, histórico e relatórios devem derivar desses estados, não criar equivalentes locais.

## Restrições arquiteturais

- local-first/offline-first;
- nenhuma dependência de Render;
- nenhuma camada de Mutations;
- nenhum SaaS necessário para abrir, revisar, salvar ou exportar;
- React futuro será camada de apresentação, nunca fonte de verdade;
- não substituir `AutosaveManager` por backup genérico;
- não duplicar persistência do CBIM em estado de UI.

## Gate para F2/F3

F2/F3 só devem avançar preservando:
- compatibilidade dos workspaces existentes;
- IDs;
- revisionamento;
- recovery;
- contrato `/api/canonical`;
- testes do core e do desktop.
