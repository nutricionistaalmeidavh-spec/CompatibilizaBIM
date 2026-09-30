# Verificação — entregas cumulativas 01–30

## Resultado executável

- Core: **51/51 testes PASS**
- CBIM Python SDK: **6/6 testes PASS**
- Cobertura Core: **90%**
- Cobertura CBIM SDK: **95%**
- `compileall`: PASS
- wheel Core `1.17.0`: BUILD PASS
- instalação limpa Core + CBIM wheels: PASS
- smoke test a partir dos wheels instalados: PASS
- Advanced Geometry curved-wall demo: PASS
- Vertical propagation/host relation: PASS
- Incremental local/global safety: PASS
- coordinate projected ↔ local round-trip: PASS (erro observado 0.0 m no caso demonstrativo)
- CBIM → IFC → CBIM round-trip: PASS

## Benchmark XXL desta execução

Configuração:

- 4 torres
- 40 pavimentos por torre
- 160 pavimentos totais
- 320 entidades CAD por pavimento
- 51.200 entidades CAD

Resultados observados em `artifacts/xxl-benchmark-01-30.json`:

- tiles: 1.440
- particionamento: ~400 ms
- throughput de particionamento: ~127.855 entidades/s
- fingerprint: ~2,68 s
- planejamento incremental: ~5,86 s
- entidades selecionadas para edição local: 169 / 51.200 (~0,33%)
- pico Python medido via `tracemalloc`: ~252,4 MB

Os números são evidência deste ambiente, não promessa de SLA em outra máquina.

## Production / Scalability Gate

`technical_gate_passed = true`

`production_ready = false`

Bloqueios deliberados:

1. `native_dwg_backend` — ODA/RealDWG não está instalado/licenciado neste runtime, portanto não há evidência executável com DWG nativo real.
2. `real_complex_building` — nenhum arquivo real de uma torre/empreendimento alto padrão foi fornecido para este runtime; fixture sintético não satisfaz este gate.

## Limitação .NET

O projeto CBIM .NET continua incluído, mas `dotnet` e `msbuild` não estão presentes neste ambiente. A validação estática de contrato permanece coberta pelos testes Python existentes; build do assembly deve ser executado em ambiente .NET apropriado.
