# Integrações preservadas

Esta área reúne versões relacionadas ao CompatibilizaBIM sem substituir a
implementação atualmente usada pelo Engenharia 360.

## CompatibilizaBIM 1.7.0

`compatibilizabim-v1.7.0/` é uma cópia integral do projeto independente
localizado originalmente em:

`C:\Users\vh_al\Desktop\Projetos\CompatibilizaBIM_v1.7.0_import\CompatibilizaBIM_v1.7.0`

Evidências de versão:

- `pyproject.toml`: pacote `compatibilizabim-poc`, versão `1.7.0`;
- `ENTREGA_v1.7.0.md`: entrega que conclui as implementações anteriores à
  integração com o FluxoDRE;
- implementação em Python com `ifcopenshell==0.8.5`;
- inclui fontes, testes, documentação, amostras, build Python e wheels das
  versões 1.3.0 e 1.7.0.

A cópia foi mantida em namespace próprio para permitir comparação e integração
gradual. Nenhum arquivo do módulo ativo `modules/compatibilizabim/` foi
substituído nesta mudança.

## Builds locais relacionados

Os builds locais `Engenharia360Release11` a `Engenharia360Release14` contêm o
módulo CompatibilizaBIM 1.7.0. Os 92 arquivos do módulo presentes nessas quatro
releases foram comparados por SHA-256 e são idênticos.

Os instaladores e diretórios `win-unpacked` não foram adicionados ao Git porque
são artefatos gerados de centenas de megabytes. A release local mais recente é
`Engenharia360Release14`, com o instalador `Engenharia 360 Setup 0.1.0.exe`.

Não foi encontrada, na árvore local investigada, evidência de `CBIM Core
v1.47.0`, `Entregas 01-50`, `ACadSharp`, `.NET 10` ou projetos xUnit.
