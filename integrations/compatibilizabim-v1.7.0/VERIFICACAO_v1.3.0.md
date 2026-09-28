# Verificação CompatibilizaBIM v1.3.0

Executada no estado final da entrega em 15/08/2026.

- `python -m pytest -q`: 110 passed, 5 skipped, 0 failed.
- `python -m compileall -q src scripts`: OK.
- JavaScript da interface desktop (`node --check`): OK.
- Wheel `compatibilizabim_poc-1.3.0-py3-none-any.whl`: construído e importado a partir de instalação em diretório limpo.
- `compatibilizabim-sinapi latest`: retorna referência 2026-07 / publicação 2026-08-11.
- Tentativa real de `compatibilizabim-sinapi update` contra CAIXA neste runtime: falhou por DNS indisponível (`Temporary failure in name resolution`), de forma fail-closed, sem traceback e sem publicação de arquivo parcial.
- Varredura simples por padrões de segredos: limpa.

## Limitações de verificação

Os 5 testes ignorados dependem do IfcOpenShell nativo indisponível neste runtime.
O binário ZIP/XLSX oficial da competência 07/2026 não foi incorporado porque o runtime de build não conseguiu resolver o host da CAIXA. Nenhuma fonte de terceiros foi usada como substituta.
