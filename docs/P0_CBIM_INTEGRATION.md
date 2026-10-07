# P0 — CBIM Core 2.1.0 no Engenharia 360

**Branch isolada:** feat/p0-cbim-core-integration  
**Snapshot recuperado:** backup/all-cbim-materials-2026-09-30-v2 (commit 6feeb60e8b376def69d9e8ddb6b3788c56418397).

## Entregue nesta branch

- Importação seletiva do CBIM Core 2.1.0, SDKs Python/.NET, esquema CBIM, ponte ACadSharp, fontes dos plugins Revit 2027 e testes. Sem copiar ambientes virtuais, binários compilados, caches e instaladores.
- Novo processo Electron app/electron/cbimRunner.cjs para conversão DWG → ACadSharp → CBIM → IFC. Original DWG, relatório de validação, telemetria, projeto CBIM e IFC permanecem em Documentos/Engenharia360/CBIM/jobs.
- Estudos BIM independentes exigem dois modelos selecionados: IFC usa exclusivamente o IfcOpenShell real; manifestos JSON com geometria usam o motor de caixas delimitadoras. Sem motor IFC, não há fallback silencioso.
- BIM vinculado a obra usa a mesma política de confiança e bloqueia mais de dois modelos em vez de ignorar os demais.
- Viewer IFC real é distinto do viewer simplificado de manifestos; IFC não processado não é apresentado como visualização geométrica completa.
- Estados de interface distinguem não analisado, em curso, concluído por motor e erro. Analises legadas sem proveniência de motor não são automaticamente consideradas válidas.
- A conversão DWG só registra IFC no projeto após a saída do pipeline relatar sanidade IFC. Mostra cobertura, pendências e diretório local de artefatos.

## Execução de desenvolvimento no Windows

Requer Node 22, Python 3.12, .NET SDK 10, instalador Git e dependências listadas nos manifestos. O runtime comercial completo ainda não foi homologado. Na raiz da branch:

\`\`\`powershell
python -m pip install -e .\integrations\cbim-2.1.0\cbim-sdk\python
python -m pip install -e .\integrations\cbim-2.1.0\compatibilizabim-core
python -m pip install -r .\modules\compatibilizabim-requirements.txt
dotnet build .\integrations\cbim-2.1.0\dwg-acadsharp-bridge\CompatibilizaBIM.ACadSharpBridge.csproj
Set-Location .\app
npm ci
npm run electron:dev
\`\`\`

A ponte ACadSharp pode ser resolvida pelo projeto .NET na árvore da branch. Alternativamente, após compilar o executável no Windows, configure a variável de ambiente CBIM_ACADSHARP_BRIDGE para o caminho da ponte. O executor local do Electron adiciona Core e SDK ao PYTHONPATH.

## Validação

- Workflow: .github/workflows/p0-cbim-validation.yml. CI executa testes Node, build Vite, Python Core, SDK e amostragem de LFS com download real do GitHub.
- O job LFS baixa apenas BARRILETE e QUA-HID, confere commit backup e hashes SHA256; **não** confere automaticamente os 1.409 objetos.
- Script scripts/verify-cbim-lfs.ps1 realiza um clone separado de backup. Padrão: SHA256 desses dois DWGs; -IncludeBuildingSmart: inclui o ZIP de 470 MB e suas 810 entradas; -Full: baixa todo o LFS e usa git lfs fsck.
- A campanha histórica de DWGs reais do usuário (incluindo BARRILETE e QUA-HID) continua válida como evidência em suas versões originais. Não afirmamos ter repetido no Windows/ Revit a validação 2.1.0.
- Não houve merge na main, deploy, atualização automática, nem alterações em segredos.

## Limites e critérios para P1

- O motor **IFC clash** da interface ainda é o Python antigo com IfcOpenShell; o novo CBIM 2.1.0 atende a conversão DWG→CBIM→IFC. Não afirmar fusão de motores.
- O instalador comercial autocontido precisa empacotar adequadamente Python + dependências nativas + ponte .NET; requer teste de instalação em máquina Windows limpa.
- O Studio completo para revisão semântica, Z, catálogo, correção de classes e autoria nativa Revit 2027 ainda necessita conexão integral e homologação funcional/visual.
- A ausência de conflitos só pode ser reportada quando um processamento real de IFC ou de manifesto geométrico retornar corretamente.
- Report de sanidade IFC não equivale a validação humana de todos os objetos. Pendências de revisão e limites de importação devem ser mostrados com clareza.
- Testar fluxo real no Windows com os DWGs conhecidos e comparar tempos, cobertura, falsos positivos, Z e conectividade com os relatórios históricos.
