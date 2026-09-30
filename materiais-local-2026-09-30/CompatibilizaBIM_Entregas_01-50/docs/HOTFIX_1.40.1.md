# Hotfix Core 1.40.1

## Falha real observada
Durante `QUA-HID-LO-0100-TERR-R02.dwg`, o pipeline concluiu Import, Geometry e Topology e entrou em Architecture. A callback `architecture_wall_candidates` enviava `elapsed=None`, enquanto o CLI formatava `elapsed` com `:.3f`, gerando `TypeError: unsupported format string passed to NoneType.__format__`.

## Correção
- mede `perf_counter()` da subetapa `architecture_wall_candidates`;
- emite `elapsed` float real;
- formatter de progresso aceita `elapsed=None` defensivamente;
- regressão automatizada cobre ambos os casos.

## Escopo
Hotfix de observabilidade. Não desativa Architecture e não altera a intenção de reconhecer todo o conteúdo do DWG.
