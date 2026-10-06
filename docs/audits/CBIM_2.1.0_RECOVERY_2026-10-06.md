# Auditoria de recuperação — CompatibilizaBIM / CBIM Core 2.1.0

Data da auditoria: 2026-10-06  
Escopo: inspeção documental e estrutural no GitHub remoto. **Nenhuma suíte de testes foi executada nesta auditoria.**

## 1. Preservação e fronteiras

- Repositório: `nutricionistaalmeidavh-spec/CompatibilizaBIM`.
- Branch original de backup: `backup/all-cbim-materials-2026-09-30-v2`.
- Commit recuperado: `6feeb60e8b376def69d9e8ddb6b3788c56418397`.
- Referência adicional criada: `archive/cbim-materials-2026-09-30-v2`, apontando para esse commit.
- Branch separada para auditoria: `audit/cbim-core-v2.1.0-recovery`; este documento está somente nela.
- `main` verificada em `9c2de1a54e9edcac55a6350e545efd316c160960`, sem merge.
- Comparação `main...backup`: 1 commit à frente, 0 atrás. O diff de arquivo do GitHub foi limitado aos primeiros 300 arquivos: **não usar esse retorno para afirmar total de arquivos**.

## 2. Material efetivamente encontrado

Na pasta `materiais-local-2026-09-30/CompatibilizaBIM_Entregas_01-50/`:
- `DELIVERY_STATUS.json` declara entregas 1–50 e `core_version = 2.1.0`.
- `compatibilizabim-core/pyproject.toml` identifica o pacote Python `compatibilizabim-core 2.1.0`.
- `cbim-sdk/python/` e `cbim-sdk/dotnet/`: contratos/SDKs separados.
- `dwg-acadsharp-bridge/CompatibilizaBIM.ACadSharpBridge.csproj` e `Program.cs`: código-fonte da ponte nativa DWG.
- `revit-plugins/`: plugins genérico CBIM e hidráulico para Revit 2027, contratos de biblioteca e scripts Windows.
- `docs/DELIVERY_1.47.0.md`: reconstrução arquitetônica, conectividade, Z, IFC.
- `docs/DELIVERY_REVIT_PHASES_14_16_2.1.0.md`: autoria nativa Revit sem IFC obrigatório.

No backup também existem `DWG/BARRILETE.dwg`, `DWG/QUA-HID-LO-0100-TERR-R02.dwg`, JSONs canônicos e artefatos de validação, além de bibliotecas/modelos de referência.

## 3. Evidências reais recuperadas — **não confundir com fixtures**

### BARRILETE (registro documentado em `docs/REAL_DWG_HARDENING_1.38.0.md`)

- Fonte real, DWG AC1032, execução Windows com bridge ACadSharp.
- 19.703 entidades convertidas; 735 não suportadas; cobertura reportada de 96,40%.
- 259 elementos reconhecidos; exportação IFC válida segundo a documentação.
- Dados históricos do hardening 1.38.0, não reteste da 2.1.0.

### QUA-HID-LO-0100-TERR-R02 (artefatos de execução da v1.40.1)

Arquivos:
- `materiais-local-2026-09-30/resultado-qua-hid-v1401/hydraulic-QUA-HID-LO-0100-TERR-R02.validation.json`
- `materiais-local-2026-09-30/resultado-qua-hid-v1401/hydraulic-QUA-HID-LO-0100-TERR-R02.timings.json`
- `materiais-local-2026-09-30/resultado-qua-hid-v1401/validation-batch.json`

Resultado registrado:
- `evidence_kind: real_project`, `provider: acadsharp`, `passed: true`, `ifc_exported: true`, `ifc_sanity_passed: true`.
- 70.422 entidades convertidas, 2.554 não suportadas, cobertura reportada de 96,50%, 45.690 entidades canônicas.
- 739 `pipe`, 605 `fitting`, 1 `equipment` relevantes e 1.312 itens `review_pending`.
- Tempos por etapa: import DWG 4,731 s, topologia 17,648 s, arquitetura 13,767 s, reconhecimento hidráulico 0,843 s.
- O campo `recognition_rate=1.0` é calculado sobre entidades consideradas *elegíveis*, não sobre o total do DWG; **não interpretar como precisão de 100%**.
- O `validation-batch.json` **deste caso** registra `production_evidence_eligible: false` com o bloqueio `all_four_disciplines_not_validated`. Isso não invalida o teste real da disciplina hidráulica.

### Corpus adicional

- `docs/REAL_DWG_REGRESSION_MANIFEST_1.40.0.md` lista **17 arquivos DWG** com hashes SHA-256 para rastreabilidade.
- O manifesto prova registro do corpus, **não** execução validada de todos os 17 arquivos nem execução da versão 2.1.0.

## 4. Git LFS — o que foi verificado

- `.gitattributes` aplica o filtro LFS **somente** a `materiais-local-2026-09-30/**` para extensões selecionadas.
- Os ponteiros LFS remotos de `BARRILETE.dwg` e `QUA-HID-LO-0100-TERR-R02.dwg` apresentam SHA-256 e tamanho coincidentes com o manifesto de regressão.
- `buildingSMART_Community.zip` possui ponteiro LFS remoto (470.654.631 bytes; SHA-256 `e07bd889e7837cb79e41774d9c156ec281def11154c3d8dc9db3ac1f33e34187`).
- A contagem de 810 entradas nesse ZIP e o envio de 1.409 objetos LFS foram relatados como validados no ambiente do usuário. **Esta auditoria não baixou/recalculou os binários LFS do servidor**, portanto não atesta sua integridade end-to-end.
- Para atestar, fazer clone limpo em ambiente com Git LFS, `git lfs pull`, `git lfs fsck`, abrir ZIP e verificar hashes no próprio ambiente.

## 5. Qualidade, versões e limites de validação

- `DELIVERY_STATUS.json` declara suites anteriores aprovadas e wheels geradas inclusive para 1.47.0 e 2.1.0. **São registros históricos, não testes rodados agora.**
- Para 1.47.0, `docs/DELIVERY_1.47.0.md` explicita que a reconstrução semântica de escadas/pisos/terminais/conexões/Z em DWGs reais/Revit ainda carecia de confirmação visual após essa revisão.
- Para 2.1.0, `docs/DELIVERY_REVIT_PHASES_14_16_2.1.0.md` explicita que a compilação e execução dos add-ins Revit 2027 com `RevitAPI.dll` não foram feitas no ambiente de empacotamento.
- O arquivo `revit-plugins/build_revit_2027.ps1` requer Revit 2027 instalado e SDK .NET na máquina Windows.
- O registro `production_blockers: actual real-project DWGs not provided/executed` em `DELIVERY_STATUS.json` descreve **o ambiente em que aquele status foi gerado**. Não deve ser interpretado como inexistência de testes reais do projeto; os relatórios reais no backup refutam essa interpretação geral.
- A chave `status` do manifesto ainda usa `technical_gate_passed_v1_44_real_windows_revalidation_required` apesar de `core_version=2.1.0`. É um indicador de defasagem documental e exige revisão de rastreabilidade por versão.
- A consulta de status do commit GitHub retornou `statuses: []`; **ausência de checks não é aprovação CI**.

## 6. Riscos identificados e prioridades

1. **P1 — rastreabilidade de versão:** associar cada execução real ao exato hash/versão do motor e ao conjunto de flags utilizado (1.38, 1.40.1, 1.41 etc.). Os resultados reais anteriores não validam automaticamente alterações 1.47/2.1.
2. **P1 — autoria nativa Revit 2027:** compilar `CBIM.Revit.Plugin` e `CBIM.Hydraulic.Plugin` no Windows com RevitAPI local; repetir cenários representativos reais para conferir conectores, fittings, níveis, equipamentos e Z.
3. **P1 — integridade LFS:** realizar inspeção fresca do remoto Git LFS. Ponteiro publicado e upload relatado não substituem download verificável.
4. **P2 — validação de produto/qualidade geométrica:** aferir manualmente amostras das 1.312 pendências do QUA-HID e taxas de falsos positivos/falsos negativos; `recognition_rate` não é métrica de precisão.
5. **P2 — desempenho:** tomar topologia e arquitetura dos DWGs reais como baseline antes de refatorações; comparar por versão e ambiente Windows.
6. **P2 — higiene do repositório:** o snapshot arquiva também `venv`, `bin`, `obj`, builds, bibliotecas e dados de terceiros. **Não fazer merge massivo desse backup na `main`**. Integrar seletivamente código/testes/licenças com revisão de dependências e tamanho.

## 7. Decisão recomendada

- **Preservado:** backup original mais referência `archive`, sem alteração de `main`.
- **Evidência real reconhecida:** BARRILETE e QUA-HID validaram partes substantivas do fluxo DWG/ACadSharp/CBIM/IFC.
- **Core 2.1.0 recuperado:** código e histórico localizados.
- **Pendente de prova localizada:** binários LFS baixáveis, reteste de regressão das mudanças 1.47/2.1 em projetos reais, compilação/execução da autoria nativa Revit 2027 e validação do gate comercial em escopo multi-disciplina.
- **Não houve:** merge, deploy, alteração no código de produção ou execução de novas suítes de testes nesta auditoria.

### Próximas verificações reproduzíveis

No Windows, na raiz do clone do backup:
```powershell
git lfs pull
git lfs fsck
```
No projeto cumulativo, após preparar ambiente Python/.NET:
```powershell
python -m compileall -q .\compatibilizabim-core\src
python -m pytest -q .\compatibilizabim-core\tests
python -m pytest -q .\cbim-sdk\python\tests
.\revit-plugins\build_revit_2027.ps1
```
O último comando exige instalação local de Revit 2027 e .NET adequados; não está incluído no escopo da auditoria remota.
