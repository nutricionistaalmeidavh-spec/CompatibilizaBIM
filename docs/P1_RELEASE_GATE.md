# P1 — check-list de liberação da edição comercial

## Componentes de produto

- [x] Core CBIM 2.1.0 e SDKs recuperados do backup, com fontes e testes.
- [x] Desktop Electron com conversão DWG → CBIM → IFC e preservação de logs/artefatos.
- [x] Studio a partir da conversão, revisão geométrica, perfis, configuração e relatório de qualidade.
- [x] Salvar, reabrir, histórico, autosave e restauração de revisão anterior com sessão protegida em loopback.
- [x] API de licença assinada Ed25519 validando cliente/instalação/recurso offline.
- [x] Build de preview separado do produto instalado, sem release automático e sem auto-update.

## Qualidade e distribuição (ver o run mais recente)

- [x] P0 Node/Python e acesso real a dois DWGs LFS aprovados no GitHub Actions.
- [ ] Regressão DWG 2.1 em Windows e comparação com histórico: requer resultado verde + inspeção dos relatórios.
- [ ] Instalação limpa do NSIS e runtime autocontido: requer artefato compilado + instalação em máquina Windows sem pré-requisitos.
- [ ] Chave pública confiável do emissor incorporada no instalador **após emissão pelo proprietário**. Nenhuma chave privada deve ser distribuída. Preview gerado no CI **não contém chave pública de produção e não ativa licenças**.
- [ ] Teste com licença offline real e revogação/expiração conforme política comercial.
- [ ] Verificação visual/semântica por projetista das quatro disciplinas, incluindo níveis Z e conectividade MEP.
- [ ] Teste de recuperação real após interrupção sem perda de alterações.
- [ ] Piloto acompanhado com cliente real e gate de evidências aprovado.
- [ ] Assinatura de código do instalador e orientações de suporte/licença para o cliente.

## Bloqueadores e decisões

- P1 em branch derivada do P0: não mergear antes do fechamento dos gates de segurança e compatibilidade.
- O preview NSIS é artefato de QA, **não uma edição automaticamente pronta para vender**.
- O Core Revit 2027 nativo ainda necessita homologação independente; não afirmar autoria nativa Revit suportada no produto comercial inicial.
- Métricas de cobertura de importação não comprovam acurácia do reconhecimento: revisar amostras reais.

## Fluxo de distribuição local

1. Em uma estação de emissão isolada, executar a CLI já existente para gerar chave privada e pública.
2. Manter a privada fora do GitHub/instalador. Emitir customer.json + license.json para cada cliente.
3. Compilar com o caminho da chave **pública** via scripts/build-p1-windows.ps1 -IssuerPublicKeyPath, após QA.
4. Instalar o aplicativo no Windows do cliente; armazenar customer.json e license.json em Documentos/Engenharia360/CBIM/license.
5. Validar o recurso desktop e cad_to_cbim sem rede e registrar o resultado do piloto.
