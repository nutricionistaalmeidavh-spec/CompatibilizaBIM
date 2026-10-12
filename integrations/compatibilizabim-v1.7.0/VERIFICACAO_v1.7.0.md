# Verificação — CompatibilizaBIM v1.7.0

- `PYTHONPATH=src pytest -q`: 131 passed, 5 skipped.
- `python -m compileall -q src`: aprovado.
- JavaScript do desktop e viewer: `node --check` aprovado.
- Wheel `1.7.0`: construído e instalado em venv local.
- Entry points `compatibilizabim-4d`, `compatibilizabim-measurements` e `compatibilizabim-measurement-report`: registrados e executáveis.
- Demo pelo wheel instalado: 10 m², 50% aprovado, custo R$100/m² -> R$500 medidos, R$500 de saldo.
- PDF de medição financeira: 1 página, renderização inspecionada sem corte/sobreposição.
- 5 testes continuam ignorados por dependerem da execução nativa do IfcOpenShell neste runtime.
- Nenhuma integração com FluxoDRE foi implementada.
