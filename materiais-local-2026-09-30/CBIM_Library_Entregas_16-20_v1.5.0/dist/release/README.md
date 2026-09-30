# CBIM Library v1.5.0 — Revit 2027 — Entregas 16–20

Pacote cumulativo **Learning Ready**. Mantém a Library como produto separado do CBIM Core, mas cria um contrato local para que os dois sistemas passem a aprender com escolhas reais depois dos testes.

## O que entrou

- Catálogo inteligente com DN/material/sistema/categoria/tipos/parâmetros/conectores.
- Quality Check por família.
- Busca técnica ranqueada e comparação entre fabricantes.
- Carregamento de tipo específico com `LoadFamilySymbol`.
- Smart Insert no Revit e substituição de instâncias compatíveis.
- Kits de novo projeto e importação de padrões de um RVT.
- Atualização diferencial, canais stable/preview, SHA-256 e assinatura RSA opcional.
- Publisher com staging report e geração de chaves.
- Rollback por pacote.
- Biblioteca pessoal + oficial + biblioteca corporativa opcional.
- Diagnóstico HTML e classificação para quantitativos/SINAPI.
- Bridge local CBIM↔Library com vocabulário, observações e feedback.

## Privacidade / Drive

O plugin distribuído continua **sem upload**. O acervo oficial é lido por manifest/HTTP e copiado ao PC. `My Library`, feedback e drag-and-drop ficam locais. A chave privada de assinatura nunca entra no plugin do cliente.

## Aprendizagem — o que começa agora

A Library passa a registrar, se habilitado:
- consulta pesquisada;
- componente escolhido;
- uso, Smart Insert, substituição, comparação;
- marcação manual `✓ Correto`.

Arquivos:
- `Bridge/Outbox/cbim-library-vocabulary.json`
- `Bridge/Outbox/cbim-quantity-catalog.json`
- `Bridge/Outbox/learning-observations.jsonl`
- `Bridge/Inbox/cbim-feedback.jsonl`

O CBIM Core poderá consumir o vocabulário e devolver feedback; nesta entrega **não existe treinamento automático de modelo nem envio de dados para nuvem**.

## Build no seu PC

Requisitos: Windows 11 x64, Revit 2027 e .NET 10 SDK. A Autodesk informa que Revit 2027 usa .NET 10 e recomenda SDK 10.0.100.

Feche o Revit e execute:

`build\BUILD_AND_INSTALL.bat`

Saídas:
- `dist\release\CBIM-Library-Setup-Revit2027-v1.5.0.exe`
- `dist\release\CBIM-Library-Publisher-v1.5.0.exe`

## Publisher

Gerar chaves uma vez:

`CBIM-Library-Publisher-v1.5.0.exe --generate-keypair D:\CBIM_KEYS`

Publicar:

`CBIM-Library-Publisher-v1.5.0.exe --source D:\CBIM_MASTER --out D:\CBIM_RELEASE --base-url https://seu-host --channel stable --mode both --sign-private-key D:\CBIM_KEYS\cbim-manifest-private.pem`

Guarde a chave privada apenas no seu computador administrativo. A chave pública pode ser configurada nos clientes para exigir assinatura.
