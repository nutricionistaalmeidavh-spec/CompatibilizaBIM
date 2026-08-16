# Reutilização de módulos

## Software de destino

O `Engenharia360` permanece um software independente. Nenhum componente foi incorporado ao Fluxo DRE e nenhum banco, rota ou serviço do Fluxo DRE é usado em tempo de execução.

## Módulos aproveitados no próprio núcleo

- `src/calculators/`: oito calculadoras originais, mantidas como módulos independentes.
- `src/domain/obras.js`: cadastro e resumo de obras.
- `src/domain/rdo.js`: RDO, ocorrências e validações de campo.
- `storage/sqliteStore.js`: persistência local, backup e histórico.
- `app/src/pdfTemplates.js`: geração local de relatórios PDF.

## Camada Software Factory

`src/factory/moduleRegistry.js` é o ponto de composição do Engenharia360. Ele expõe os módulos reutilizáveis sem fundir os produtos: cálculos, obras, RDO e apresentação podem ser consumidos por telas ou futuros produtos da fábrica. `src/factory/format.js` é o primeiro módulo reaproveitado do Fluxo DRE, adaptado sem dependências de React ou Electron.

## Fontes versionadas adicionadas

As oito planilhas de referência foram copiadas para `references/planilhas-originais/`. Elas são mantidas como fonte de conferência e rastreabilidade; não são executadas diretamente pelo sistema.

## Módulos avaliados e não copiados

Os serviços do Fluxo DRE dependem de Electron, React, `better-sqlite3`, IPC e do schema financeiro/operacional próprio daquele software. Copiá-los para o Engenharia360 criaria acoplamento e misturaria os produtos. Por isso, foram rejeitados para reutilização direta:

- `electron/services/database.cjs`;
- `works-service.cjs`, `planning-service.cjs` e `field-service.cjs`;
- componentes React de `src/components` e `src/modules`;
- `document-service.cjs` e serviços de folha/RH.

Quando uma capacidade for necessária no Engenharia360, ela será implementada por um adaptador próprio sobre os módulos compartilhados, sem importar o aplicativo Fluxo DRE.
