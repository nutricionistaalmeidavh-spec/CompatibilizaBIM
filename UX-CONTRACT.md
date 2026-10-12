# CompatibilizaBIM Studio — Contrato funcional P1

## 1. Navegação e contexto
- Obras guarda seu próprio histórico; BIM permite entrar na revisão. Não existem duas cópias de cada tela.
- Migrar automaticamente rotas legadas salvas `Revisão → BIM`, `Histórico → Obras`.
- Obra, frente, período, vínculo e estudo BIM selecionado vivem no SQLite canônico. Não perder o estudo ao retornar da revisão. Estudo independente não é falsamente associado à obra ativa.

## 2. Importar
- Métodos: `.dwg` via ACadSharp; `.dxf` via ezdxf; `.ifc` como fonte original geométrica do motor IFC; `.cbim.json` via parser tipado no workflow. Arquivos CAD não são fingidos como JSON/IFC.
- Disciplina obrigatória, DXF sem INSUNITS usa escala explicitamente escolhida; DWG XREF e blocos DXF ausentes geram avisos. Os jobs, fontes e relatórios ficam no armazenamento local anterior.
- Formato/tamanho inválido: erro antes de persistir. Processamento: progresso e cancelamento; conclusão somente após `ifc_sanity_passed`. `IFC validado` não significa sem pendências semânticas.
- Importação repetida utiliza fingerprint do arquivo inteiro como dica de duplicata, não como assinatura criptográfica nem licença.

## 3. Revisão
- A geometria vem de `start/end`, `path`, `boundary`, `position/center` ou bbox do projeto CBIM; objetos sem coordenada permanecem listados e são contabilizados.
- As projeções 2D/3D compartilham IDs e a seleção com o inspetor. Estados `auto/confirmed/edited/rejected` possuem rótulos legíveis.
- Z, diâmetro, pavimento e sistema só são editáveis quando a entidade e valores suportam isso; não gerar classes geométricas artificiais.
- A revisão permanece marcada `não salva` até POST autenticado no workspace. Um erro preserva alterações e oferece novo salvamento. O histórico e o autosave ficam no CBIM WorkspaceStore original.

## 4. Critérios de prova
- Node: geometria projetada, ausência de coordenadas falsas, edição sem mutação, migração canônica, contratos de importação.
- Python: conversão DXF real, integridade de output IFC, regressão CBIM/SDK.
- GitHub Actions: React build, Playwright smoke, isolamento de autenticação, conversão DWG/ACadSharp Windows e instalador QA.
- Sem teste manual de usabilidade/Windows limpo, não declarar homologação comercial. O visualizador axonométrico não substitui inspeção BREP.
