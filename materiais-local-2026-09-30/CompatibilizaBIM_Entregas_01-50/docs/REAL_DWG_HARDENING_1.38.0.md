# Real-DWG hardening — Core 1.38.0

Esta atualização é um hardening cumulativo das entregas 01–50, orientado pelos primeiros DWGs reais processados no Windows com o bridge ACadSharp compilado.

## Evidência de baseline observada

No `BARRILETE.dwg` (AC1032), a execução externa reportou 19.703 entidades convertidas, 735 não suportadas, cobertura de importação de 96,40%, 1.014 entidades canônicas, 259 elementos reconhecidos e IFC válido. O `recognition_rate` antigo de 25,54% era calculado contra todas as entidades canônicas, incluindo anotações e outra disciplina.

Layers observados no Canonical do projeto real incluíram:

- `H-AF-TB`: linework de tubulação de água fria;
- `H-AF-CX`: inserts de conexão; exemplo `H-U-AF-TB_COR0900_20`;
- `H-INC-TB` / `H-INC-CX`: tubulação/conexões de incêndio;
- `REDE SPK`: sprinkler;
- `TEXTO`, `SETAS`, `COTA`, `COTAS`, `TEXTO AMBIENTE`: anotação, não elegível a objeto BIM MEP.

## Mudanças

1. `H-AF-TB` é reconhecido como Pipe, e `H-AF-CX` como Fitting/Equipment conforme o bloco.
2. `H-INC-TB`, `H-INC-CX` e `REDE SPK` são separados da disciplina hidráulica e tratados pelo recognizer de incêndio.
3. Nomes de bloco como `COR0900_20` fornecem evidência de curva 90° e DN20.
4. `recognition_rate` MEP usa somente entidades elegíveis daquela disciplina; textos/cotas/setas e outra disciplina saem do denominador.
5. O relatório inclui `eligible_source_entities`, `ignored_source_entities`, `unclassified_eligible_count`, `unclassified_by_layer` e `unmapped_by_layer`.
6. O catálogo não atribui fabricante/material sem preferência ou especificação explícita do projeto.
7. Elementos de alta confiança só são auto-confirmados quando possuem evidências suficientes e não carregam `requires_review`.
8. Diâmetro default fica explicitamente marcado com `diameter_source=recognizer_default` e requer revisão.
9. JSONs de validação/CBIM usam escape ASCII para impedir mojibake em shells Windows antigos; ao parsear o JSON os textos continuam `Térreo`, `Água fria` etc.
10. `merge_collinear_lines` foi substituído por bucketing + ordenação de intervalos (~O(n log n)), eliminando o all-pairs repetitivo do algoritmo anterior.
11. `cbim-validate-dwg` agora imprime START/DONE e tempo por estágio e grava `<case>.timings.json`.
12. O perfil conservador `Observed Brazil MEP v1` é aplicado por padrão; regras do usuário continuam podendo sobrescrevê-lo.

## Benchmark de regressão

No ambiente de verificação desta entrega, a normalização de uma cadeia sintética de 50.000 segmentos colineares caiu para aproximadamente 0,5 s. Isto é evidência da correção algorítmica, não uma promessa de tempo total para um DWG real.

## Reteste recomendado no Windows

Após instalar a versão 1.38.0 e compilar o bridge:

```powershell
.\validate_hydraulic_windows.ps1 -Dwg "C:\tmp\DWG\BARRILETE.dwg" -Output "C:\tmp\resultado-barrilete-138"
.\validate_hydraulic_windows.ps1 -Dwg "C:\tmp\DWG\QUA-HID-LO-0100-TERR-R02.dwg" -Output "C:\tmp\resultado-qua-hid-138"
```

Compare `*.validation.json` e `*.timings.json` com os resultados anteriores. O resultado pós-patch em DWG real precisa ser executado no Windows; este ambiente não possui .NET/ACadSharp runtime.
