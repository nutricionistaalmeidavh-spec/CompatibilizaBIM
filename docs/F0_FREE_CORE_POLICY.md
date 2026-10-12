# F0-01 — núcleo gratuito no instalador (DWG → CBIM → IFC)

## Contrato observável
- No CompatibilizaBIM Studio, o estado inicial é **gratuito/local**. Importar DWG, analisar, exportar IFC e abrir a revisão CBIM **não pedem ativação** por padrão, mesmo no Electron empacotado.
- A opção `CBIM_STUDIO_LICENSE_MODE=free` tem o mesmo comportamento padrão; a ausência de `license/public.pem`, `customer.json` e `license.json` não é erro no núcleo.
- **Somente** `CBIM_STUDIO_LICENSE_MODE=commercial` ativa a checagem de licença na conversão empacotada. A checagem exige os três arquivos offline, assinatura e o recurso `cad_to_cbim`; uma licença inválida não inicia job. A abertura do Studio usa a política comercial existente e exige recurso `desktop`.
- Qualquer valor de modo desconhecido é erro explícito; não há fallback silencioso.
- A execução, os arquivos DWG, IFC, validações e workspaces permanecem locais em `Documentos/Engenharia360/CBIM/jobs`.
- O sistema deve diferenciar **pré-requisitos técnicos ausentes** (ponte ACadSharp ou runtime), **IFC ainda sem sanidade confirmada**, **pendências de revisão** e **recurso comercial não autorizado**. Nenhum deles deve aparecer como pedido de compra/ativação no modo gratuito.

## Jornada verificada por testes
1. Usuário seleciona um DWG e a disciplina, com `CBIM_STUDIO_LICENSE_MODE` ausente.
2. Job executa `validate-dwg` diretamente, sem subprocesso `verify`.
3. Saída com `ifc_sanity_passed` e relatório de provedor `acadsharp` permite criar o workspace via `studio prepare`; o original permanece preservado.
4. Com `commercial` escolhido, os arquivos de licença são obrigatórios **antes** do job, e uma recusa de assinatura/recurso interrompe a conversão.
5. Modo desconhecido falha com mensagem de configuração.

**Testes**: `test/p0FreeCoreConversion.test.cjs` — cenários livre explícito, padrão, opt-in comercial, assinatura/recurso rejeitado e modo inválido. Os testes de política de abertura existentes continuam em `test/studioLicenseMode.test.cjs`.

## Limite da evidência
Os testes usam fixtures de processo e arquivos IFC de teste para aferir política de licença e encadeamento, **não comprovam a geometria DWG nem uma instalação Windows limpa**. A homologação Windows + amostras BARRILETE e QUA-HID segue em F0-04. Não reclassificar preview NSIS como produto homologado com base somente na regressão Node.
