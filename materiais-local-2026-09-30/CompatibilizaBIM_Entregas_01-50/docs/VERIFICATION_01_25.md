# Verificação — entregas cumulativas 01–25

## Resultado

- Core: **42/42 PASS**
- CBIM Python SDK: **6/6 PASS**
- Cobertura Core: **91%**
- Cobertura CBIM SDK: **95%**
- `compileall`: PASS
- XREF block expansion regression: PASS
- large-coordinate round-trip: PASS
- multi-tower hierarchy: PASS
- revision diff: PASS
- incremental local-change planning: PASS
- benchmark fixture 50k: PASS

## Benchmark sintético desta máquina

Consulte `artifacts/large-building-summary-01-25.json`. O valor de throughput é evidência do algoritmo de **particionamento**, não promessa de performance end-to-end do conversor completo.

## Limitações não mascaradas

1. SDK .NET não foi compilado neste ambiente por ausência do .NET SDK/MSBuild.
2. Provider DWG licenciado não é redistribuído.
3. Conversão geodésica entre CRSs não faz parte desta entrega; o frame recebe coordenadas já projetadas.
4. Ainda falta benchmark end-to-end XXL com DWGs reais de edifício alto padrão.
