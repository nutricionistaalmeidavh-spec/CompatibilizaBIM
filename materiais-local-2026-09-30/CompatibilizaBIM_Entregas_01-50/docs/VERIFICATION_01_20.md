# Verificação cumulativa 01–20

## Veredito

**Aprovado para continuidade do desenvolvimento integrado do Core Python.** As entregas 16–20 foram exercitadas individualmente e no pipeline cumulativo. Dependências externas de DWG, .NET e IFC genérico permanecem declaradas como limitações de ambiente/provedor.

## Evidência executável

- CBIM Python SDK: 6/6 testes PASS.
- CompatibilizaBIM Core: 29/29 testes PASS.
- Cobertura Core: 91%.
- `compileall`: PASS.
- Geometry/Topology/Architecture/Levels/Structure/Reviewer anteriores: regressão PASS.
- Catálogo Brasil: match por sistema, diâmetro e preferência de fabricante PASS.
- MEP Connectivity: Tê no meio de linha provoca split do trecho e mantém uma única componente conectada PASS.
- Recognition Intelligence: confiança recalibrada com evidências explícitas PASS.
- Quantities: comprimentos, áreas, volumes e contagens PASS.
- Core Integration Gateway: viewer primitives, clash candidates, issue targets, quantities e work packages PASS.
- Pipeline 01–20: Profile → MEP → connectivity → catalog → intelligence PASS.
- Demo cumulativo: 14 elementos CBIM, 2 sistemas MEP, 2 redes, 4 relações, 3 matches de catálogo e IFC4 STEP com 146 entidades.

## Limitações não mascaradas

1. SDK .NET continua sem build local porque o ambiente não possui `dotnet`/MSBuild.
2. DWG de produção exige ODA/RealDWG ou provider equivalente; binários/licenças não são redistribuídos.
3. Importação IFC genérica de terceiros exige backend como IfcOpenShell.
4. Catálogo 2026.08 é seed por famílias/sistemas; ingestão integral de SKU/códigos/medidas exigirá atualização/ETL específico por fabricante.
5. O Core Integration Gateway entrega contratos de dados estáveis; integração UI/render/clash em um repositório externo só pode ser feita quando esse repositório estiver acessível.
