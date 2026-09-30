# Manifesto de entrega 01–30

## 26 — Advanced Geometry

**Aceite:** curvas CAD são analisadas e podem ser convertidas em segmentos adaptativos com erro de corda limitado, metadados de aproximação e proveniência da entidade original. Geometria inclinada, não ortogonal e polylines inválidas são diagnosticadas.

## 27 — Vertical / Repeated Building Intelligence

**Aceite:** pavimentos repetidos são comparados por fingerprint geométrico relativo ao nível; alinhamentos verticais são identificados; elementos confirmados de um pavimento-tipo podem ser propagados para níveis-alvo preservando hosts e relações internas.

## 28 — Incremental Reprocessing

**Aceite:** uma alteração local seleciona apenas a região afetada e dependências CBIM; alterações com potencial global (remoção, INSERT, block definition ou configuração) forçam rebuild global. O executor escolhe explicitamente processor local/global.

## 29 — XXL Benchmark Suite

**Aceite:** cenário reproduzível com >= 50.000 entidades, múltiplas torres e >= 100 pavimentos mede particionamento, hashing/fingerprint, planejamento incremental, hierarquia e pico de memória.

## 30 — Production / Scalability Gate

**Aceite da entrega:** existe um gate executável, com critérios rastreáveis, que separa technical readiness de production readiness. O gate **não pode** aprovar produção com cenário apenas sintético.

**Estado desta execução:** technical gate = PASS; production ready = NO, bloqueado por `native_dwg_backend` e `real_complex_building`.
