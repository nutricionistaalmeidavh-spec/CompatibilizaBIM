# F0 — Integridade, engenharia, runtime Windows e gates

Base: CompatibilizaBIM Studio React único, arquitetura Electron + SQLite (SQL.js), CBIM Core Python, ACadSharp .NET.
F0-01 foi entregue em PR #6.

## F0-02 — Banco confiável
- Gravador desktop `app/electron/databaseStore.cjs`: valida cabeçalho/encoding de SQLite, escreve arquivo temporário com `fsync`, preserva o estado anterior como `engenharia360.sqlite.previous`, só então substitui o arquivo principal com `rename`. Se uma falha ocorrer antes da substituição, o arquivo anterior permanece íntegro. Para uso real, mantenha também backups externos; o arquivo `.previous` não é solução para falha física de disco.
- A migração SQL.js é transacional, conserva `user_version`, rejeita schema futuro e não oculta erros de ALTER. A persistência somente ocorre após `PRAGMA integrity_check`. Um estado anterior permanece no snapshot desktop.
- Backups exportados mantêm `versao: 1`; `tamanhoBytes` e `checksumCrc32` são opcionais, aceitos por versões antigas. CRC-32 detecta acidentes de transporte, **não** é uma assinatura criptográfica.
- A importação valida base64, assinatura de cabeçalho SQLite, checksum se houver, `PRAGMA integrity_check` com o motor real SQL.js e presença de `obras` **antes** de substituir o armazenamento. Falha não fecha o DB atual; erro é exibido sem afastar o usuário do Studio. Arquivos legados continuam nos paths originais.
- Workspaces CBIM sob `Engenharia360/CBIM/jobs` continuam persistidos por seu `WorkspaceStore` e snapshots/recuperação próprios. Esta entrega não migra nem limpa esses arquivos. A cópia de segurança de um **projeto completo** exige preservar tanto o arquivo SQLite como `CBIM/jobs` e documentos externos; o backup JSON do Studio cobre somente o banco. Um bundle integrado permanece fora do escopo F0-02 e deve ser apresentado claramente à pessoa.

## F0-03 — Solver estrutural
- Os registros `cargas_estruturais` existentes são lidos por vínculo `elemento_id`, caso `permanente/variavel/acidental` e unidade compatível com a do modelo.
- Tipos aceitos: distribuída uniforme, força concentrada no **meio do vão** e momento concentrado no **meio do vão**. Forças têm direção **Y global**, momentos em **Z global**. Vetores nodais consistentes para viga Euler-Bernoulli 2D e pórtico linear 3D, transformados do referencial local ao global.
- Referências por nome ou ID do nó são normalizadas. Material numérico é persistido em JSON nas mesmas colunas TEXT (sem schema paralelo).
- Cargas de barra não suportadas, sem elemento, com referência inválida ou unidade divergente impedem cálculo; são indicadas claramente. Cargas nodais legadas são tratadas como permanentes. Reações calculadas em apoios para auditoria; o relatório identifica o caso aplicado. **Não** são inferidas combinações ELU/ELS, coeficientes normativos, excentricidades ou posição de carga não informadas.
- Os resultados são **análise linear elástica preliminar**, não dimensionamento ou laudo automático de conformidade NBR.
- Testes analíticos com balanço: qL⁴/(8EI), carga concentrada em L/2, momento invertendo sinal e resposta 3D, mais rejeições explícitas.

## F0-04 — QA Windows automatizado, sem instalação local
- `scripts/build-p1-windows.ps1` gera ACadSharp self-contained, PyInstaller, executa `cbim-runtime.exe health` e compila NSIS.
- `scripts/f0-smoke-real-dwg.ps1` é executado depois da compilação em GitHub Actions Windows hospedado: baixa dois arquivos DWG reais de ref Git LFS imutável, valida SHA-256, executa `cbim-runtime.exe validate-dwg` com a ponte empacotada e exige relatório `provider=acadsharp`, IFC exportado, `ifc_sanity_passed=true` e arquivo IFC existente. Um limiar semântico reprovado retorna CLI 1 e é reportado sem confundir geometria/IFC com homologação humana.
- O artefato QA inclui somente resumo sanitizado de cobertura, pendências e IFC, sem subir DWGs privados ou workspaces. Nenhuma instalação do aplicativo é solicitada.
- **Limitação deliberada**: executar runtime e gerar NSIS no runner NÃO substitui a instalação manual em Windows limpo, teste de atualização no ambiente final, interpretação humana de quatro disciplinas e eventual Revit. Marcar esses gates como `pendente`; não declarar certificação de uso comercial.

## F0-05 — Release safety
- CI P0 + P1 acionada em PR por etiqueta `run-cbim-qa` (ou `workflow_dispatch`), sem execução em cada commit.
- Node, Python, segurança do Studio, Playwright Chromium, compilação React, integridade Git LFS, runtime Windows, smoke dos 2 DWGs e instalador NSIS devem ser verdes.
- Manifesto QA com SHA-256 do instalador, runtime e ponte, versões e ref de commit; diferenciar `ciValidated` e `humanHomologated` explicitamente.
- Não reverter ou sobrescrever workspaces existentes; merges somente depois de todos os gates automatizados aprovados.
