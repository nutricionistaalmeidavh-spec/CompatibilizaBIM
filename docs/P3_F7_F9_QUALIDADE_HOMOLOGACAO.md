# P3 · F7–F9 — Diagnóstico de qualidade, evidências e gate de distribuição

## Propósito

Esta entrega usa a aplicação **React única** e os motores/arquivos canônicos existentes. O P2 foi mesclado na main na PR #13. O P3 introduz mecanismos verificáveis de **inspeção e preparação de piloto**, não uma declaração de conformidade profissional.

### F7 · Gestão de obras em revisão

Na seção **Qualidade → Diagnóstico**, o sistema agrega as obras locais, todos os períodos e todas as frentes, mesmo quando filtros do cabeçalho estão ativos. Exibe a quantidade de RDOs aprovados e pendentes, pendências, medições operacionais aprovadas/pendentes, entregas e vínculos BIM. Não contabiliza duas vezes pagamentos, medição, custos de material nem compromissos de compra. A seção é **somente leitura**.

O banco é consultado pela projeção `listarResumosQualidadeObras`: consulta estado dos RDOs, mas **não** carrega `dados_json` (fotografias), base64 de documentos, arquivos DWG/IFC, nem workspaces externos. A interface não cria outro modelo nem banco.

### F8 · Memórias de engenharia e limites da verificação

A análise lista os 34 tipos com oráculo de verificação independente existente. As memórias salvas são **revalidadas** de acordo com seu tipo, entradas e resultado; tipos não reconhecidos e memórias quebradas são contados como não verificados. Uma validação matematicamente positiva **não** demonstra atendimento integral à NBR, revisão da vigência da norma ou aprovação de projeto. Os perfis normativos e responsabilidade técnica precisam ser conferidos externamente.

### F9 · Evidências de distribuição e homologação

O centro de qualidade exporta JSON anônimo com contagens e códigos de alerta, versão e data; **não exporta nomes, dados de cliente, dados de empregados, desenhos, GUIDs, evidências fotográficas, credenciais, endereços ou números bancários**.

O checklist de homologação externa permanece **pendente** até evidência profissional independentemente revisada:

1. Instalação real em Windows 10/11 limpo, sem Node/Python/.NET externo.
2. Comparação humana entre DWG real e IFC gerado — geometria, cotas Z, disciplinas, semântica e conectividade.
3. Abertura IFC em ferramenta independente e, quando aplicável, Revit.
4. Persistência e recuperação comprovada após interrupção e reabertura do projeto.
5. Licença emitida pelo proprietário, expiração, revogação, assinatura do instalador.
6. Piloto com projetista/usuário real, consentimento, métricas e aceite registrado externamente.

*Não* marcar aprovações via interface nem usar os resultados de CI como se fossem aprovação humana. O modelo de evidências externo existente fica em `docs/pilot/P1_PILOT_EVIDENCE_TEMPLATE.json`. O gate do motor Core e eventuais exigências de assinatura, licenciamento ou responsável habilitado permanecem em vigor.

## Gate de integridade do preview Windows

Depois que o build NSIS e o smoke com os DWGs terminarem, o CI executa:

```powershell
node scripts/p3-release-check.cjs --manifest .p1-build/f0-smoke/release-manifest.json --root . --out .p1-build/f0-smoke/p3-release-readiness.json
```

O script verifica: identificação *QA ONLY*, presença e formato das declarações do manifesto, integridade do tamanho e **SHA-256 efetivo dos arquivos** do instalador NSIS, `cbim-runtime.exe` e ponte ACadSharp. Falha fechada se ausentes, diferentes ou modificados. A saída sanitizada acompanha os demais relatórios no artefato Windows QA; ela explicita `humanHomologated=false` e `commercialReleaseApproved=false` em qualquer execução.

**Critérios automatizados de aceite P3:** Node (inclusive testes F7/F8 e P3), Python Core/SDK, Vite, Playwright com abertura da página Qualidade e exportação sanitizada, binário autocontido, DWGs de amostra verificados, runtime Windows/NSIS e hash checks. O fluxo roda apenas quando a etiqueta `run-cbim-qa` é aplicada ou via dispatch manual, não a cada commit.

**Ainda fora da comprovação automática:** homologação humana, confiabilidade IFC de todos os tipos/disciplinas, hardware e instalação limpa real, licença de produção, assinatura de código, revisão integral NBR e piloto de cliente.

O P3 **não** migra SQLite, apaga workspaces, altera projeto aprovado, lança despesa automática, publica instaladores ou adiciona atualização remota.
