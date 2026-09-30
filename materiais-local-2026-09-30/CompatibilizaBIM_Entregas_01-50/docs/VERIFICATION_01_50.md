# Verificação — entregas cumulativas 01–50

## Resultado executável
- Core: 74/74 testes passando.
- CBIM SDK: 6/6 testes passando.
- Cobertura Core: 93%.
- Cobertura CBIM SDK: 96%.
- `compileall`: PASS.
- wheel Core 1.37.0: construído.
- wheel CBIM 0.3.0: construído.
- instalação dos wheels em target isolado e importação fora da árvore-fonte: PASS.
- `cbim-desktop --help` / `cbim-commercial --help`: PASS.
- criação/reabertura de workspace pelo pacote instalado: PASS.
- licença Ed25519 demo verificada pelo pacote instalado: PASS.
- servidor desktop local `/api/status` e Studio: PASS.
- HTML parser e `node --check` do Studio 01–50: PASS.
- Pilot Gate de fixture: corretamente BLOQUEADO (exit 3).

## Critérios de qualidade importantes
1. Persistência usa gravação atômica e schema CBIM; campos calculados não são persistidos.
2. Autosave não cria snapshots repetidos quando o conteúdo é idêntico.
3. Recovery só oferece restauração após sessão não limpa.
4. Licença usa assinatura assimétrica; a chave privada de emissão não é incluída nos artefatos.
5. O produto não pode considerar fixture sintético como evidência comercial real.
6. O desktop serve apenas em loopback por padrão (`127.0.0.1`).

## Limitações ainda externas
- ACadSharp bridge real continua sem build/execução neste runtime por ausência de .NET/NuGet/rede.
- nenhum DWG real de cliente foi fornecido; por isso o First Commercial Pilot Gate permanece bloqueado.
- pacote desktop é portável via Python; MSI/EXE assinado deve ser produzido em pipeline Windows específica.
