# P2 + P3 — Engenharia contextual e alternativas matemáticas

## Onde acessar
Abra **Cálculos** na aplicação React Studio. Selecione o estudo BIM no topo da tela (ou no contexto superior). Selecione uma das 34 calculadoras e execute o cálculo validado. Agora o fluxo apresenta:

1. **Memória técnica P0/P1** — resultados legíveis, diagramas idealizados e sensibilidade matemática.
2. **Engenharia assistida P3** — escolha parâmetro, limites, grandeza, operador e até duas restrições; busque menor ou maior valor amostrado viável.
3. **Comparar alternativas** — situação inicial, candidato inverso (se disponível) e alternativa manual. Cada cenário executa a calculadora e o oráculo matemático atuais; resultados e hipóteses ficam visíveis.
4. **Vincular ao BIM P2** — selecione o modelo, opcionalmente uma análise, conflito e elemento identificado. Salve explicitamente no mesmo SQLite.
5. **Histórico contextual** — recupere a memória sem editar o registro; revisão, hash e assinatura geométrica são comparados com o modelo atual. Se mudarem, exiba pendência de reconferência. Pendências da coordenação listam as memórias associadas, sem mudar o próprio status.

## Integridade de dados
- A tabela **`estudos_engenharia_bim`** é a fonte canônica das *novas* memórias contextualizadas (com referências tipadas). `calculos` permanece intacta para as memórias preexistentes associadas a obras, sem migração destrutiva.
- Uma memória contextual pode pertencer a um projeto BIM **independente de obra**. Quando o projeto possui `obra_id`, o serviço valida que o contexto da obra não contradiz a origem.
- `modelo_id`, `analise_id`, `conflito_chave` e `elemento_ref` são aceitos somente após validação contra o projeto, modelo, análise e conflito efetivamente carregados. Para IFC sem elementos indexados, só GUIDs provenientes de um conflito com proveniência conhecida são elegíveis; o vínculo **apenas ao modelo** permanece possível.
- `contexto_json` captura revisão, hash do arquivo, assinatura do conjunto de elementos e fingerprint do conflito. A memória é imutável e tem status **preliminar**: não atualiza arquivo IFC, análise, BCF ou pendência automaticamente.
- `alternativas_json` armazena os resultados da comparação com validação; essas alternativas não são novos cálculos de obra e não são aplicadas ao projeto por efeitos colaterais.
- `CURRENT_SCHEMA_VERSION = 4`; migração transacional e backup SQLite atualizados sem apagar calculadoras, obras ou projetos antigos.

## Limites P3
- A busca utiliza **41 amostras** com até **24 iterações** de refinamento da fronteira de viabilidade e opera sobre **um único parâmetro numérico** de cada vez.
- Até duas restrições configuráveis pela interface (o núcleo permite até três), com `<=` ou `>=`. O motor bloqueia métricas inexistentes, limites não finitos e variáveis desconhecidas.
- Retorna **candidato matemático amostrado**, não afirma ótima solução global ou conformidade técnica. Falhas de cálculo e do oráculo independente invalidam candidatos. Caso nenhuma amostra atenda, registra `nao_encontrado`; isto *não prova* inviabilidade de todo o domínio.
- Cronograma/orçamento composto permanece fora do dimensionamento inverso genérico; exige método próprio para etapas e datas.
- Escolher **Carregar no formulário** não altera o IFC nem salva cálculo automaticamente: o engenheiro deve executar a verificação novamente e registrar um novo snapshot.

## QA e distribuição
- `npm test`: P2/P3 regras puras, oráculo existente e regressões canônicas.
- `node --test test/p2P3Engineering.test.js test/p2P3Storage.test.js` (com dependências `app/node_modules` resolvidas pelo CI).
- `npm run build --prefix app`: interface React única.
- `scripts/qa/reactBrowserSmoke.cjs`: nova navegação de engenharia assistida e testes completos da aplicação.
- Não habilitar serviços pagos nem dependências de nuvem. Não disparar workflow por commit: executar apenas o gate GitHub `run-cbim-qa` no PR.
