# CompatibilizaBIM Studio — UI canônica

**Usuário:** engenheiro, projetista e coordenador BIM que recebe desenhos CAD, confirma um modelo e registra conflitos e decisões sem perder rastreabilidade.

**Regra estrutural:** apenas uma entrada React (`app/src/react/main.tsx`), um Electron, SQLite local e CBIM Core. A revisão autenticada usa a mesma entrada React em `?surface=review`, em contexto loopback isolado, nunca um renderer Vanilla.

**Direção visual:** aplicação técnica densa, sem glassmorphism, navegação única por tarefas (Projetos, Engenharia, Execução), cabeçalho fino, contexto persistido, painel central de geometria e inspetor lateral. Paleta existente de azul técnico/ardósia com estados distinguíveis por texto e forma; campos com labels, feedback e foco visível. Elementos de revisão: 2D planta, projeção 3D axonométrica, lista sincronizada e origem CAD. Sucesso somente após confirmação do motor/SQLite.

**Primitivos:** `app/src/react/components/ui.tsx` (Button/Card/Status/EmptyState), `app/src/react/shell/navigation.js` (rotas), `storage/sqliteStore.js` (obra/frente/período/estudo BIM), `app/src/react/studio/geometry.js` (coordenadas CBIM). Não implementar stores visuais paralelos.

**Responsividade:** desktop CAD prioriza desenho; telas menores empilham lista e visualizador sem esconder decisões. Geometria que não pode ser desenhada recebe diagnóstico e continua acessível na lista.

**Limite geométrico:** projeção 2D e axonométrica são visões dos objetos canônicos, não tesselação BREP nem comprovação de sólidos IFC. A inspeção sólida permanece no motor IFC existente.
