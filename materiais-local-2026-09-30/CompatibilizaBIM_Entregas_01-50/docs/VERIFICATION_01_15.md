# Verificação cumulativa 01–15

## Resultado

**Parcialmente aprovado para desenvolvimento integrado.** O Core Python e o contrato CBIM passaram por execução fresca. Há duas limitações externas não mascaradas: SDK .NET não compilado neste ambiente e backend DWG proprietário não disponível.

## Evidência

- 23/23 testes do CompatibilizaBIM Core: PASS
- 6/6 testes do CBIM Python SDK: PASS
- Cobertura Core: 89%
- Cobertura CBIM SDK: 95%
- `compileall`: PASS
- Wheel Core 1.2.0: construído com `pip wheel --no-build-isolation`
- instalação limpa de `cbim-sdk` + `compatibilizabim-core` wheels: PASS
- smoke test fora da árvore-fonte: PASS
- DXF demonstrativo → Profile → Geometry → Topology → Architecture/Structure → Hydraulic/Fire → CBIM: PASS
- IFC4 STEP demonstrativo: header/schema/end marker e entidades verificadas
- IFC → CBIM lossless round-trip do arquivo gerado: PASS

## Limitações não encobertas

1. O SDK .NET possui código e testes xUnit, mas `dotnet`/MSBuild não existe neste ambiente.
2. O provider DWG de produção exige ODA/RealDWG ou equivalente; o pacote não inclui binário/licença de terceiros.
3. A importação IFC genérica de arquivos produzidos por terceiros ainda depende de IfcOpenShell.
4. O IFC geométrico desta entrega materializa arquitetura/estrutura; MEP continua plenamente representado no CBIM, e sua semântica IFC avançada será ampliada em entregas posteriores.
