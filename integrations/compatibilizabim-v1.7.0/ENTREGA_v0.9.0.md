# CompatibilizaBIM v0.9.0 — Entrega

Esta entrega fecha o núcleo da Fase 10 (produto desktop local):

- projetos persistentes e `obra_id` opcional;
- drag-and-drop/upload de IFC;
- deduplicação SHA-256 e validação básica de IFC;
- preflight, compatibilização por regras e viewer em background;
- progresso, cancelamento cooperativo e recuperação de jobs interrompidos;
- cache geométrico persistente;
- logs diagnósticos JSONL;
- servidor apenas em loopback;
- proteção contra path traversal;
- wheel instalável em `release/`;
- base PyInstaller + Inno Setup em `packaging/`.

## Iniciar a interface desktop

Após instalar o projeto:

```bash
compatibilizabim-desktop
```

Ou use `run_desktop_windows.bat` / `run_desktop_linux_macos.sh`.

## Verificação desta entrega

- 69 testes passaram;
- 5 integrações nativas foram ignoradas por ausência de IfcOpenShell no runtime de validação;
- JavaScript desktop/viewer: sintaxe válida;
- wheel 0.9.0: build e instalação limpa OK;
- 9 entrypoints CLI: `--help` OK;
- servidor instalado: smoke test HTTP OK;
- bind externo: bloqueado;
- busca por segredos óbvios: limpa.

O `Setup.exe` ainda precisa ser construído/testado em Windows real. O script `scripts/build_windows_desktop.ps1` e os arquivos de configuração necessários estão incluídos.
