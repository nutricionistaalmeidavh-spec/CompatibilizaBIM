# Diagnóstico de usabilidade — Engenharia 360

Data: 15/08/2026  
Ambiente: preview local `http://127.0.0.1:5173/?demo=1&v=calc-groups1`  
Perfil avaliado: desktop, dados fictícios, modo offline.

## Veredito geral

Os fluxos principais estão navegáveis e a estrutura horizontal ficou coerente. O produto ainda não está pronto para uma validação com usuário real porque há um erro funcional no resultado das calculadoras, estados de módulo que ficam presos entre seções e rótulos que dizem “próxima etapa” para telas que já existem.

## Fluxos auditados

1. **Entrada / Obras — parcial**
   - A obra demo aparece rapidamente e o estado offline é claro.
   - A tela inicial repete o card da obra e o Obra 360; falta uma hierarquia mais explícita entre “selecionar obra” e “criar obra”.
   - Evidência: `01-obras-inicial.png`, `12-cadastro-obra.png`.

2. **Obra 360 — parcial**
   - Reúne avanço, RDO, pendências, cálculos, materiais, cronograma e BIM.
   - É uma tela muito longa, sem índice/âncoras; várias linhas colam título, responsável e status (`FundaçãoEquipe...`).
   - Há conflitos BIM repetidos na lista de pendências da demonstração.
   - Evidência: `09-obra360.png`.

3. **RDO — parcial**
   - O formulário cobre equipes, serviços, materiais, ocorrências, impedimentos, fotos e observações.
   - O modal é alto e o botão de salvar fica fora da primeira área visível; faltam agrupamentos por seção e indicação clara dos campos obrigatórios.
   - Evidência: `10-rdo-formulario.png`.

4. **Biblioteca de cálculos — boa organização, execução bloqueada**
   - O agrupamento por temática reduziu bastante a poluição visual.
   - Ao executar “Viga biapoiada completa”, o resultado aparece como “Revisar” com o erro `resumoResultados(...).map is not a function`.
   - Enquanto esse erro existir, o usuário não consegue confiar no resultado, salvar a memória ou entender a validação.
   - Evidência: `02-calculos-grupos.png`, `03-calculo-resultado-erro.png`.

5. **Compatibilidade BIM independente — parcial**
   - O estudo independente, os modelos, classes IFC, gravidade, explicação e ações de conflito estão claros.
   - O botão “Viewer IFC real” continua desabilitado no fluxo vinculado à obra; a análise real de grandes IFCs ainda não é demonstrada no preview.
   - Evidência: `04-bim-estudo.png`.

6. **Operação — parcial**
   - O hub apresenta os nove módulos e os fluxos de Frentes, Medições e Contratos abrem e exibem dados.
   - Frentes, Medições e Contratos aparecem como “próxima etapa” embora já tenham telas e persistência. Isso reduz a confiança e contradiz o que o usuário consegue fazer.
   - Evidência: `05-operacao-hub.png`, `06-frentes-servico.png`, `13-medicoes.png`, `14-contratos.png`.

7. **DRE / Financeiro — parcial**
   - DRE, Contas e Folha abrem com dados locais e métricas úteis.
   - Os três cartões aparecem como “próxima etapa” apesar de funcionarem.
   - Ao navegar entre seções, o detalhe do módulo anterior fica preso no hub seguinte: por exemplo, “Frentes de serviço” aparece dentro do DRE.
   - Evidência: `07-dre-hub.png`, `08-dre-local.png`, `15-contas.png`, `16-folha.png`.

8. **Backup offline — inconclusivo com risco de confiança**
   - A ação “Exportar backup” está sempre visível.
   - Não há confirmação visual de sucesso, nome do arquivo, data/hora ou indicação de integridade; “Importar backup” também aparece como texto genérico.
   - Evidência: `11-backup-sem-confirmacao.png`.

## Achados prioritários

### P0 — Corrigir antes de demonstrar cálculos

O resultado da calculadora quebra a renderização da lista de resultados. Corrigir o contrato de `resumoResultados`/`calculatorResult` e adicionar um teste de interface que execute uma calculadora e confirme a presença dos valores, da validação e da ação de salvar.

### P1 — Corrigir o estado de navegação

Ao trocar entre Operação e DRE, `activeModule` não é limpo. O detalhe selecionado em uma seção aparece na outra. O estado do módulo deve ser resetado sempre que `activeSection` mudar ou ser validado contra o grupo atual.

### P1 — Atualizar o catálogo de status

`INTEGRATED_MODULES` não contém `frentes`, `medicoes`, `contratos`, `dre`, `contas` e `folha`. O catálogo deve refletir a implementação real e apontar para os fluxos existentes.

### P1 — Melhorar densidade e separação de dados

Aplicar `gap`/layout de duas colunas nas linhas, separar visualmente título, metadados e valor, e adicionar navegação por seções no Obra 360.

### P2 — Dar fechamento às ações offline

Adicionar toast/estado de sucesso para backup, PDF, CSV, JSON e salvamento local; informar nome do arquivo e permitir verificar a última exportação.

## Acessibilidade e limites da evidência

- Os textos de gravidade e status não dependem apenas de cor, o que é positivo.
- Não foi possível afirmar conformidade de teclado, leitor de tela, zoom do sistema ou navegação por foco apenas pelas capturas.
- A auditoria foi feita em desktop com demo local; não cobre instalador Electron, máquina limpa, modelos IFC grandes, IFC corrompido, restauração de backup, fluxo real de upload IFC ou Viewer 3D gerado fora da aplicação.

## Próxima sequência recomendada

1. Corrigir o erro de resultado das calculadoras.
2. Corrigir `activeModule` e os rótulos de integração.
3. Ajustar espaçamento/estrutura das linhas e criar âncoras do Obra 360.
4. Adicionar feedback de sucesso/erro às ações offline.
5. Repetir a auditoria com teclado, viewport estreito e um IFC real.
