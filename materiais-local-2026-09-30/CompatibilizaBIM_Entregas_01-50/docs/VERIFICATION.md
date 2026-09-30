# Verificação

## Resultado

- CBIM SDK Python: 6 testes passando; 95% coverage.
- CompatibilizaBIM Core acumulado: 16 testes passando; 86% coverage.
- `compileall`: passando.
- Wheels Python: construídos sem acesso de rede usando build isolation desativado.
- Smoke test dos wheels instalados em diretório limpo: passando.
- DXF real → pipeline completo → CBIM: passando.
- CBIM demonstrativo validado contra JSON Schema: passando.
- Reviewer HTML offline: gerado e coberto por teste de contrato; interação visual em navegador não foi automatizada neste ambiente.
- .NET SDK: fonte e testes xUnit presentes, mas build/execução não verificados por ausência do SDK .NET/MSBuild no ambiente.

## Demonstração

`artifacts/cad-to-cbim-demo.dxf` gera:

- 4 walls
- 1 column
- 1 door hospedada
- 1 named space
- 1 beam
- 2 slabs (uma com papel de foundation)
- 1 opening
- 1 storey

Também são gerados o grafo topológico e um Reviewer HTML local.
