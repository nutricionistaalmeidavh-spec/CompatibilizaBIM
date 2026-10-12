# CompatibilizaBIM Studio — roadmap integrado de produto, engenharia, UX e qualidade
**Versão:** 1.0 · **Data:** 2026-10-12 · **Base de auditoria:** main @ `bd6a72e2a9674d2454a2991734205e89f40fe2ec`
**Natureza:** plano de execução e critérios de aceite; este documento não implica funcionalidades implementadas ou homologadas.

## 0. Objetivo e limites
Transformar uma base ampla de motores locais em um **produto desktop React único, previsível, offline-first, com fluxo verificável DWG/DXF/IFC → CBIM → revisão → compatibilização → quantitativos → 4D/5D → medição → obra/financeiro**. Preservar SQLite, modelos, workspaces, backups, históricos e formatos canônicos. Evitar forks de motores e implementações UI duplicadas.

**Usuários-alvo:** projetista e coordenador BIM (foco primário); engenheiro de obra (RDO/medição); responsável técnico (conferência e liberação); administrativo (custos/contas). Não inferir automaticamente privilégios de um perfil; produto local pode funcionar sem login.

**Restrições de produto:** núcleo de importação/conversão/compatibilização **gratuito e executável sem licença ou conexão de terceiros**. Recursos comerciais, se existirem, devem ser opt-in claramente identificados; Revit/Autodesk são integrações opcionais e dependem de licenças externas, nunca uma obrigação para o núcleo. Nenhum consumo de API paga nem nuvem obrigatório. Não integrar eSocial, bancos ou outros sistemas externos nesta sequência.

**Evidência disponível:** código em `app/src/react`, `app/electron`, `storage`, `src`, `modules/compatibilizabim`, `integrations/cbim-2.1.0`; P0/P1 e smoke Playwright do PR #4 passaram. **Evidência ausente:** instalação limpa com projeto legado real, piloto humano, precisão de reconhecimento por disciplina, performance em projetos pesados no Windows e homologação Revit.

## 1. Modelo canônico — não começar pela aparência
Identidades e vínculos planejados (mantendo adaptadores para as tabelas existentes, sem troca disruptiva de banco):
```
Obra (opcional para estudo independente)
 ├─ Frente → etapa/tarefa → RDO → medição operacional → custo/receita
 ├─ Contrato → aditivo → composição/orçamento → medição aprovada
 └─ Projeto BIM → fonte CAD/IFC → job de conversão → revisão do modelo
                                ├─ elemento CBIM → geometria, classe, Z, rede, evidência e confiança
                                ├─ modelo IFC → versão → federação
                                ├─ análise de conflitos → decisão → pendência BCF
                                ├─ quantitativo rastreável → composição SINAPI local → orçamento 5D
                                └─ atividade de cronograma → 4D → avanço → medição BIM
Workspace local → snapshot, histórico, backup, recuperação e integridade
```
**Princípios:** um modelo-fonte e suas revisões devem ter identidade persistente; a mesma pendência não pode virar registros inconciliáveis em motores/SQLite; parâmetros de período, obra, frente e disciplina precisam filtrar dados reais ou ficar inativos explicitamente; alterações de orçamento/medição jamais alteram IFC de origem. A diferença entre `bim_modelos` (vinculado à obra), `bim_projetos/bim_modelos_avulsos` (independente) e `CBIM/jobs` será coberta primeiro por adaptadores de leitura/escrita, depois por migrações aditivas versionadas.

## 2. Jornada de produto e arquitetura de informação
**A. Coordenador BIM:** abrir projeto → adicionar DWG/DXF/IFC e XREF → escolher unidade, origem, disciplina, pavimentos → iniciar job → acompanhar fases/cobertura/avisos → selecionar elemento 2D/3D → corrigir classe/rede/Z → confirmar → exportar IFC válido e reabrível → comparar revisões → compatibilizar → gerar BCF e relatório. Êxito exige inspeção geométrica e persistência real, não apenas arquivo gerado.

**B. Engenheiro de obra:** selecionar obra → ver modelos federados e conflitos → quantificar → orçamento/composição → vincular cronograma 4D → medir produção → aprovar → confrontar valores contratados/pagos → emitir RDO/PDF. Êxito exige que dados e unidades permaneçam rastreáveis ao mesmo GUID/obra/competência.

**C. Recuperação:** realizar alterações → fechar abruptamente/reabrir → recuperar última revisão verificável → entender diferenças antes de restaurar → manter backup anterior e auditoria.

**Navegação proposta:** Projetos/Obras (entrada) → em cada projeto: **Visão geral | Modelos | Revisão | Conflitos | Quantitativos | Planejamento | Orçamento e medições | Obra e registros**. Calculadoras ficam em Ferramentas técnicas com ligação opcional à obra; Administração local contém backup/configuração. Separar **Revisão** de **BIM** e **Histórico** de **Obras**; remover entradas que apenas reproduzem outra página.

**Esboço funcional desktop (não mockup aprovado):**
```
Topo fino: [CompatibilizaBIM] [Projeto ativo ▾] [Revisão] [Salvo localmente] [Ajuda]
Navegação contextual: Modelos | Revisão | Conflitos | Quantidades | 4D | 5D | Obra
┌ Árvore modelo/camadas ┐┌ Canvas 2D/3D, IFC ─────────────────┐┌ Propriedades e decisões ┐
│ fontes / disciplina   ││ zoom, seção, isolar, selecionar     ││ tipo, evidência, Z     │
│ pavimento / busca     ││ indicação visual de conflito       ││ confirmar / corrigir   │
└───────────────────────┘└───────────────────────────────────┘└─────────────────────────┘
Barra inferior: jobs, avisos, status de persistência, execução, recuperação
```
Larguras pequenas: lista/busca/pendências/RDO com inspector em drawer; tarefas CAD geométricas complexas terão indicação clara de uso desktop. Mobile-first nos formulários/consulta; densidade e precisão para CAD desktop.

## 3. Padrão visual e de interação (Frontend Design Premium + Intuitive Software Design)
Criar `DESIGN.md` e `UX-CONTRACT.md` **antes de reformar múltiplas telas**, documentando tokens e proprietários canônicos: tipografia, cores, grid, tabela, filtro, formulário, diálogos, toast, seleção, status, arquivos, data e descarga.
- **Direção visual:** estação técnica de engenharia: tipografia legível, alinhamento preciso, contraste alto, superfícies neutras, hierarquia por função e estados. Sem glassmorphism, gradientes decorativos ou cards repetitivos para grandes tabelas. Preservar e harmonizar linguagem já usada no Studio, sem rebrand arbitrário.
- **Tokens-semente para prototipar (a aprovar em revisão visual):** grafite `#182433`, cinza técnico `#F4F6F8`, branco `#FFFFFF`, borda `#CCD5DF`, ciano profundo `#0E7490`, aviso `#B45309`, erro `#B42318`. Corpo Inter ou IBM Plex Sans, números/coordenadas em IBM Plex Mono. Não consolidar valores sem testar contraste e telas existentes.
- **Padrão interativo:** ação → processamento explícito/cancelamento → confirmação com nome de artefato/salvamento → falha acionável com preservação do rascunho → reabertura contextual. Erros não ficam ocultos atrás de console técnico.
- **CRUD:** criar/editar compartilham validação e unidades; edição preserva contexto; exclusões e restaurações têm prévia de impacto; aviso de salvamento só após persistência confirmada.
- **Tabela técnica:** filtros persistentes realmente aplicados, sorting, busca, densidade confortável/compacta, ações por linha, coluna de origem/unidade/status, estados sem dados e sem resultado diferenciados.
- **A11y e i18n:** pt-BR, separadores numéricos/unidades coerentes, foco visível, teclado na tabela e no viewer, contraste WCAG 2.2 AA onde aplicável, `aria-live`, labels e mensagens, reduced-motion.
- **Teste de compreensão:** um projetista novo deve saber (1) o que foi importado, (2) o que está inferido ou confirmado, (3) o que impede exportar, (4) como recuperar trabalho — sem conhecimento de módulos internos.

## 4. Sequência de execução — gates e entregas

### F0 — Bloqueadores de integridade, licenças e resultados (P0; primeiro)
**F0-01 | Licença gratuita:** remover exigência incondicional no `app/electron/cbimRunner.cjs` quando `isPackaged`; modo padrão `free` também na conversão DWG. Validar recursos pagos apenas com seleção explícita e sem bloquear recursos do Core. Casos: preview Windows sem `customer.json/license.json/public.pem`, offline → converter DWG de teste, sem mensagens de ativação; `commercial` ausente/expirado → bloquear somente recurso comercial, manter Core.
**F0-02 | Dados e backup:** inventariar/versionar schemas SQLite e CBIM jobs; backup automático antes de importação; validação de versão, integridade, checksum e prévia; restauração transacional/atômica com rollback; snapshots de workspaces; abertura de fixture SQLite legada e preservação de chaves/histórico/documentos. Teste de desligamento abrupto sem perda.
**F0-03 | Solver estrutural:** tornar canônicos casos/combinações e mapear `cargas_estruturais` para vetores de forças do solver 2D e pórtico 3D; considerar carga distribuída, concentrada e momento, unidades, referenciais e restrições. Provas analíticas independentes de equilíbrio/deslocamento; erro explícito para combinação ainda não suportada; sem resultado aparentemente válido quando carga foi ignorada.
**F0-04 | Smoke nativo e regressão real:** validar runtime Python empacotado, ponte ACadSharp e IfcOpenShell em Windows limpo; abrir banco existente em **cópia**, converter BARRILETE e QUA-HID, testar geometria/IFC/logs/cancelamento e salvamento; distinguir testes sintéticos de homologação humana.
**F0-05 | Proteção do release:** travar dependência de motor/versão, verificação de artefatos e tamanho, reportar proveniência, exigir P0/P1/Playwright/Windows. CIs acionados por `workflow_dispatch` ou label/PR definido, **nunca a cada commit**. Gate impede merge de alteração que perca dados ou bloqueie Core gratuito.

**DoD F0:** Core empacotado funciona sem pagamento; backup+rollback real; cargas usadas e conferidas; Windows com DWG real validado; gate fail-closed. *Nenhum trabalho 4D/5D depende de F0 inteiro, mas qualquer integração em produção depende dele.*

### F1 — Fundação da experiência React e modelo compartilhado (P1)
**F1-01:** trocar abas duplicadas `Revisão`/`Histórico` por fluxos próprios; manter uma única entrada React e mesma janela Electron. Abertura autenticada do CBIM em superfície React preserva navegação, título e retorno.
**F1-02:** `ProjectContext` canônico: obra, projeto, fonte, revisão, disciplina, frente, intervalo, modo de BIM; validar relações, propagar filtros para queries e exibir resultado/limites, sem filtros decorativos.
**F1-03:** criar `DESIGN.md`, `UX-CONTRACT.md`, primitives compartilhados de formulário, campo numérico/unidade, estado de job, tabela, drawer de inspector, notificação e confirmação.
**F1-04:** auditabilidade: **Histórico** de ações por projeto e artefato, snapshots legíveis, diff pré-restauração; distinguir histórico de obra, de BIM e de dados financeiros.
**F1-05:** primeira experiência local guiada: projeto de demonstração opt-in, estado vazio orientado, atalhos, erros e status de dados explícitos. Nada cria demo silenciosamente em banco de produção.
**DoD F1:** nenhuma navegação duplicada; 100% controles contextuais aplicados ou desabilitados; 3 jornadas de usuários percorridas sem links secretos; teclado e resolução 390/768/1440 cobertos; validação de falha/recovery.

### F2 — Importação DWG/DXF/IFC + federação e confiabilidade (P1)
**F2-01:** assistente de importação por fonte (`.dwg/.dxf/.ifc/.cbim.json`), pré-validação e disciplina sugerida/confirmada.
**F2-02:** XREF ausente, unidades, origem, pavimentos, coordenadas georreferenciadas, tolerâncias, perfis locais e versões mostrados antes da execução; escolha reversível e relatório de impacto.
**F2-03:** jobs com progresso por etapa, cancelamento seguro, logs para suporte, tempo/memória, resultado parcial marcado, artefatos originais imutáveis e sanidade IFC antes de registrar modelo.
**F2-04:** normalização de modelos da obra, estudos independentes e workspaces CBIM via adaptador canônico sem descarte nem nova cópia do mesmo modelo. Reimportação idempotente, GUID/revisões preservados.
**DoD F2:** 4 formatos de entrada com estados claros; nenhum fallback IFC silencioso; amostras das quatro disciplinas e XREF ausente; produção da IFC inspecionável; revisão preservada após reimportar.

### F3 — Revisão geométrica real e semântica CBIM (P1/P2)
**F3-01:** viewer IFC/CBIM realmente geométrico e coordenado: canvas 2D/3D, árvore pavimento/camada/rede, zoom, orbit, section/clipping, seleção por elemento/GUID, ocultar/isolar, enquadramento e localizar do inspector.
**F3-02:** inspector com tipo/classe, nível Z, rede, diâmetro, material, geometria, origem/layer/bloco/texto, confiança, evidências, avisos. Diferenciar `inferido`, `confirmado`, `editado`, `rejeitado`.
**F3-03:** correção real dos campos semânticos e geométricos permitidos com prévia, validação, undo/redo, versionamento e reprocessamento dependente; **não** marcar `editado` só por trocar estado.
**F3-04:** revisão em lote por filtros, prioridades baseadas em risco e confiança, notas, perfis CAD aprendidos *somente* de exemplos humanos confirmados.
**F3-05:** autosave atômico, diff de revisões, recuperação de sessão e rollback sem sobrescrita silenciosa; exportação IFC/CBIM controlada pelos blockers.
**DoD F3:** abrir DWG real, localizar em geometria e corrigir 10 elementos; fechar/reabrir e recuperar tudo; comparar original vs exportação IFC externamente; revisão humana registra precisão, falsos positivos e Z.

### F4 — Compatibilização, pendências e coordenação (P2)
**F4-01:** seleção e federar N modelos (não somente dois); diferenciar IFC real de caixa simplificada de manifesto, com proveniência do motor.
**F4-02:** modos interseção/colisão/afastamento, tolerâncias com unidades, matriz disciplina × disciplina, severidade por regra, agrupamento/deduplicação.
**F4-03:** viewer aponta conflito e elemento, preserva câmera/filtros entre alterações, faz snapshot; status aberto/em revisão/resolvido/ignorado, responsável, prazo, motivo, comentários e auditoria.
**F4-04:** comparação entre revisões: novos, persistentes e resolvidos; não repetir pendência encerrada sem evidência geométrica; export BCF 3.0/CSV/JSON/PDF com GUID/viewpoint e validação.
**DoD F4:** dois IFC reais com conflitos conhecidos e uma federação multiarquivo; BCF interoperável em leitor externo; resolução não é declarada sem análise efetiva da revisão nova.

### F5 — Quantitativos BIM e orçamento 5D rastreável (P2)
**F5-01:** expor `modules/compatibilizabim/quantities.py` e `compatibilizabim_core.quantities` via adapter Electron/IPC, com fonte por GUID, QTO, pavimento, disciplina, revisão, unidade, regra de fallback e grau de confiança.
**F5-02:** tabela auditável: agrupar, filtrar, inspecionar origem, corrigir exceções justificadas e comparar revisão; não contar elementos duas vezes.
**F5-03:** importar/cadastrar composições locais e versões SINAPI com UF/mês/fonte/BDI/perdas; mapear IFC→composição; composição incompleta não gera custo fictício.
**F5-04:** orçamento analítico e sintético por serviço/frente/pavimento; curva ABC, cenários e export JSON/CSV/PDF; congelamento de versão orçamentária.
**DoD F5:** demonstrar GUID→quantidade→unidade→composição→custo em amostras; conciliar totais com referências, versão SINAPI visível; nenhum preço escolhido ou baixado silenciosamente; reutilização de motor Python, não reimplementação em React.

### F6 — Planejamento BIM 4D e medições (P2)
**F6-01:** adaptar `schedule.py` / `simulation4d.py`: importar CSV, predecessoras, datas, calendário, status, baseline e associação GUID↔atividade; validações de vínculos ausentes.
**F6-02:** linha do tempo/Gantt com seleção sincronizada no viewer, datas real x planejada, evolução/Curva S, simulação reproduzível por data.
**F6-03:** medição BIM por GUID, avanço acumulado, medições anteriores, conferência de excesso/duplicação, aprovação/rejeição com responsável e data; ajustes auditáveis.
**F6-04:** conectar `measurement_financial.py` ao orçamento 5D; previsto vs realizado vs medido vs pago. Não confundir progresso físico com recebimento financeiro.
**DoD F6:** importação de cronograma e vínculo a modelo; alteração de revisão sinaliza atividades impactadas; duas medições sucessivas sem dupla contagem; aprovação deixa trilha verificável.

### F7 — Operação, RDO, contratos e finanças (P2/P3)
**F7-01:** revisão UX de obras, etapas, frentes, checklists, tarefas/pendências; indicadores com período/frente realmente aplicados, busca/ordenação e estados claros.
**F7-02:** RDO completo: equipes, horários, atividades, ocorrências, foto com legenda/data, anexos, assinatura/identificação de aprovação, correção rastreada, exportação PDF **com fotos** e paginação.
**F7-03:** contratos/aditivos, compras, recebimentos, materiais e orçamento operacional ligados a uma mesma obra/centro de custo, sem mudanças de estado implícitas.
**F7-04:** financeiro: separar previsão, competência, caixa, empenho, medido, faturado e pago. Conciliação manual e trilha; DRE gerencial com escopo explícito (não DRE contábil oficial). Folha inicial permanece registro operacional até existir motor de cálculo trabalhista homologado.
**F7-05:** PDF/CSV com mesma informação da tela e identificador de revisão; exportáveis reproduzíveis, falha acionável, impressão e acessibilidade.
**DoD F7:** tarefa completa compras→recebimento→custo→DRE gerencial; RDO com 3 fotos no PDF; comparação dos totais por frente/competência, sem valores somados em duplicidade.

### F8 — Engenharia, normas e calculadoras (P2/P3)
**F8-01:** colocar `pilarAvancado`, `fundacaoIntegrada` e `paredeConcreto` nos grupos adequados, total **34/34 acessíveis**; descoberta/busca/favoritos e categorias coerentes.
**F8-02:** contrato tipado por calculadora: unidade, faixa válida, dependências, casos de cálculo, metadados normativos e laudo que diferencia pré-dimensionamento de verificação.
**F8-03:** oráculos matemáticos independentes para cálculos prioritários e comparação com planilhas de referência; reconciliação NBR por edição antes de selo de conformidade; jamais exibir “aprovado” quando só se verificou finitude.
**F8-04:** estruturas: visualização 2D/3D, nós, cargas, combinações, condições de apoio, diagramas, deformadas, equilíbrio/resíduos e exportação de memória; documentar escopo linear/elasticidade e exclusões de segunda ordem.
**F8-05:** PDF/DXF de detalhamento técnico com cotas/unidades e rastreabilidade; não apresentar artefato preliminar como prancha executiva.
**DoD F8:** 34 entradas descobertas e calculáveis; verificações independentes por amostra significativa e relatório de normas; solver aplica e exibe cargas por casos, sem omitir ações.

### F9 — Distribuição, documentação, licença e validação externa (P3; release gate)
**F9-01:** escolher licença OSS do produto com aprovação do titular e auditar licenças das dependências; publicar `LICENSE` / `NOTICE` e política de dados locais. **GitHub público não basta**.
**F9-02:** alinhar versão do Studio, Core, SDK, contrato e instalador; changelog, rollback, migrações, suporte e matriz de compatibilidade Windows 10/11.
**F9-03:** instalador NSIS autocontido, smoke manual em máquina limpa e reabertura de projetos pré-React; desinstalar não apaga `Documentos/Engenharia360`; registrar evidências de instalação.
**F9-04:** piloto real em arquitetura/estrutura/hidráulica/incêndio com desenho autorizado, medição de precisão/recall de classes, Z, conectividade, falsos positivos/negativos, export IFC e aceite. O `FirstCommercialPilotGate` recebe **evidência real**, não fixture artificial.
**F9-05:** Revit 2027 em trilha opcional **separada**: compilação e validação no Revit instalado, seleção de famílias/fitings, conectores, rollback da autoria, compliance Autodesk. Não bloquear release gratuito por isso.
**DoD F9:** entrega reproduzível com suporte mínimo, dados preservados, piloto assinado/aceito por usuários relevantes e sem alegações de validação ainda não comprovadas.

## 5. Backlog priorizado, dependências e esforço relativo
Esforço `S` pequeno, `M` médio, `L` grande, `XL` muito grande; são ordens de grandeza relativas **sem compromisso de prazo**. Ordenar pela próxima capacidade utilizável e por dependência real.

| Ordem | Épico | Prioridade | Depende de | Esforço | Saída verificável |
|---|---|---|---|---|---|
| 01 | F0-01 licença gratuita | P0 | — | S | DWG empacotado funciona em modo free sem licença |
| 02 | F0-02 backup/restauração e schema | P0 | — | M | Banco legado reabre, importa e reverte sem perda |
| 03 | F0-03 solver e cargas | P0 | — | L | Casos de carga completos, verificações numéricas |
| 04 | F0-04 Windows + DWGs reais | P0 | 01–03 | M | Runtime e importação homologados no Windows |
| 05 | F1 design/UX/contracts/navegação | P1 | 02 | L | Navegação canônica, estados e filtros coerentes |
| 06 | F2 assistente CAD/IFC e projetos | P1 | 01–02,05 | XL | Pipeline único robusto e rastreável |
| 07 | F3 revisão/inspector geométrico | P1 | 06 | XL | Revisão real com persistência e IFC válido |
| 08 | F4 conflitos e BCF | P2 | 07 | L | Revisão comparativa, pendências e interoperabilidade |
| 09 | F5 quantidades/5D | P2 | 06–07 | XL | Rastreio GUID→quantidade→composição→custo |
| 10 | F6 4D e medição | P2 | 05,09 | XL | Cronograma, simulação e medição cumulativa |
| 11 | F7 operação/RDO/financeiro | P2 | 05,09–10 p/ integração | L | Dados operacionais e financeiros conciliados |
| 12 | F8 calculadoras/normas/estruturas | P2 | 03,05 | L | 34/34 e parecer técnico honesto |
| 13 | F9 distribuição/piloto/Revit opcional | P3 | 01–12 p/ release integral | XL | Homologação humana e operação comercial documentada |

**Paralelismo seguro:** F0-01 / F0-02 / F0-03 em branches diferentes; F8-01 paralela a F1; F4 e F5 após contrato de F2/F3; relatórios RDO podem avançar após F1. Não unir sem validação de contrato. A release limitada do Core gratuito não espera 4D/5D ou Revit se os gates relevantes estiverem aprovados.

## 6. Estratégia de branches, CI e artefatos
- Branch específica por entrega: `fix/free-core-packaged`, `fix/sqlite-restore-atomic`, `fix/structural-loads`, `feat/studio-context-ui`, `feat/cbim-review-3d` etc. Um PR por contrato funcional, não um mega-PR.
- Todo PR possui TDD ou fixture anterior à alteração, prova de migração/retrocompatibilidade quando envolve dados, inspeção de UX, screenshots reais e descrição `before → after`.
- Fluxo GitHub Actions somente **acionado manualmente ou pelo gate rotulado** de QA, evitando workflows automáticos em cada commit.
- Pipelines separados: `unit-node`, `python-core-sdk`, `dotnet-acadsharp`, `windows-runtime-installer`, `browser-e2e`, `sample-dwg-pipeline`, `migration-recovery`, `performance-benchmark`, `a11y`.
- E2E não usa stub na prova de exportação CAD/IFC, licença, API de persistência, migracão de banco, conversão de geometria ou BCF; stubs servem só a testes de apresentação isolados.
- Evidências de clientes reais nunca sobem ao repositório público. Relatórios sanitizados e hashes sem DWG proprietário.
- Merge somente se a respectiva entrega passar seus gates; usar tag e instalador QA de cada marco, com rollback antes de distribuição.

## 7. Métricas, validação e condições de lançamento
**Cobertura de fluxo:** 100% das ações críticas devem indicar `não iniciado / processando / sucesso / falha recuperável / requer revisão`; nenhum erro silencioso. A interface não pode afirmar “IFC compatível” só porque há um arquivo.
**Preservação:** banco, anexos, projetos e decisões originais reabrem em cópia de banco real/sintético representativo, sem mudança não autorizada; restaurar backup não deixa estado parcial.
**Precisão CBIM:** medir `TP/FP/FN`, posição XYZ, diâmetro, classe, conectividade e revisão pendente em amostras reais por disciplina. Limiar mínimo do gate comercial já existente: cobertura importação >=95%, reconhecimento elegível >=80%, revisão manual <=25%, >=100 objetos reais — critérios de entrada, nunca garantia de acurácia. Somar avaliação humana e consistência em leitor IFC externo.
**Usabilidade:** cenários de importação, revisão, resolução, orçamento, RDO e recuperação realizados por projetistas sem apontar botões; medir conclusão independente, erros recuperáveis, passos extras e compreensão do status. Definir metas numéricas após baseline.
**Desempenho:** medir P50/P95 tempo importação, clash, render, abertura, pico de RAM e incremental vs total no hardware alvo; fixar limites de aceitação só após baseline reproduzível.
**Acessibilidade:** teclado, contraste, labels, foco, anúncios e erro por campo testados; fluxos desktop e mobile informacional.
**Conformidade:** norma declarada/edição associada ao cálculo, status de reconciliação, aviso de pré-dimensionamento e responsabilidade técnica explícitos.
**Homologação:** fases C–E do `docs/P1_PILOTO_E_HOMOLOGACAO.md` e `docs/P1_RELEASE_GATE.md` validadas com evidência; review real no Windows/Revit opcional.

## 8. Sequência de releases sugerida
- **R0 — Core gratuito confiável:** F0 + recorte essencial F2; sem licença oculta, sem perda de dados; primeiro pacote Windows para operação DWG→CBIM→IFC.
- **R1 — Studio de revisão profissional:** F1–F4; usuário importa, revisa visualmente, corrige, compara, coordena e exporta no React.
- **R2 — Engenharia 4D/5D conectada:** F5–F6 + integração relevante F7; quantitativos, composições, cronograma, medição, financeiro com rastreabilidade.
- **R3 — Operação aprofundada e homologação:** F7–F9; calculadoras e solver revisados, qualidade visual, pilotos reais, emissão/lançamento controlados.
- **Trilha paralela opcional:** Revit nativo, famílias e conectores, nunca requisito do R0–R3 gratuito.

## 9. Primeiro conjunto de PRs
1. **PR F0-01:** teste de red de `isPackaged && !license` + correção do bloqueio gratuito no `cbimRunner.cjs` e testes CLI/Windows; não enfraquecer verificação comercial opt-in.
2. **PR F0-02:** fixture SQLite anterior à migração + backup imutável + importação segura e restauração testada.
3. **PR F0-03:** caso real/analítico de viga/carga distribuída/carga concentrada e combinação → corrigir solver, exibir diagnóstico.
4. **PR F1-00:** `DESIGN.md` + `UX-CONTRACT.md` e mapa de telas/objetos; testes de navegação e acessibilidade (sem reformar todo o CSS).
5. **PR F8-01:** adicionar as 3 calculadoras faltantes à navegação + prova 34/34.
6. **PR F0-04:** QA Windows limpo e artefatos sanitizados das duas amostras; documentar o que foi realmente exercitado.

**Ordem do primeiro esforço:** proteger o núcleo e os dados; não priorizar aparência antes de corrigir os riscos críticos. O design system deve entrar em paralelo com QA do Core e guiar a interface dos fluxos F2–F7.

## 10. Fora de escopo intencional para esta sequência
Nuvem obrigatória, SaaS, assinatura, eSocial, conciliação bancária automatizada, acesso remoto multiusuário, marketplace, integrações pagas necessárias para ler/converter arquivos, e autoria Revit como condição para funcionar. Podem virar trilhas futuras após os releases fundamentais.
