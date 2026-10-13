# P4 — Memória PDF, QTO IFC e simulação de impacto 5D

## Fluxo canônico

Cálculos → estudo BIM → modelo e GUID → cálculo validado → salvar memória preliminar
→ **Ver memória** → **Exportar memória BIM PDF**.

Se houver IFC original, QTO e catálogo 5D disponíveis no runtime desktop:
**Ver memória** → **Consultar QTO e orçamento 5D** → conferir origem e revisão
→ selecionar grandeza IFC → preencher quantidade proposta e hipótese → **Simular impacto preliminar**
→ **Registrar simulação no SQLite**.

O histórico também aparece em **BIM → 4D/5D**, abaixo do orçamento e da conciliação operacional, reutilizando o MESMO componente React. A UI de cálculos e a aplicação não foram duplicadas.

## Contratos existentes reutilizados

- `engineeringStorage.bim.p2` consulta as ações `status`, `quantity_records` e `budget_report` do motor Python 4D/5D. Não se cria motor paralelo, serviço HTTP ou conta.
- QTO apenas quando `source === 'ifc_qto'`; `geometry_fallback` nunca habilita preço ou estudo de impacto.
- O registro QTO deve possuir o GUID exato do estudo, `source_file` igual ao IFC do modelo, e esse IFC deve constar no relatório QTO. Não se converte bbox/manifesto em quantidade real.
- O contrato QTO disponível não fornece hash de arquivo/revisão. Por isso o usuário confirma **expressamente** que os quantitativos correspondem à revisão registrada. O PDF documenta esta limitação, sem afirmar verificação automática do hash.
- O preço unitário é derivado exclusivamente de linha única e compatível do orçamento 5D local, com unidade, classe, disciplina, pavimento, tipo e quantidade idênticos. Não distribui o custo de um grupo pelo número de elementos.
- O delta é `(quantidadeProposta - quantidadeOriginal) * final_unit_cost` e utiliza custo unitário **final** (perdas e BDI já contemplados pelo motor 5D), sem aplicar BDI novamente.
- Sem tabela de preços, sem correspondência única ou sem competência/fonte de preço BRL: custo é `null`, nunca zero presumido. Quantidade física pode ser registrada sem preço.
- Até mesmo com preço: delta é simulação de um GUID, **não** reorçamentação oficial, custo contratual, custo executado ou medição aprovada.

## Imutabilidade e banco

O esquema SQL.js incrementa sua versão de 4 para 5. `impactos_engenharia_bim` é append-only e aponta para `estudos_engenharia_bim` e `bim_projetos`. O snapshot inclui QTO original e proposto, unidade, delta, composição, fonte, referência de preços, GUID, nome IFC, revisão e hipótese.

Registros antigos em `calculos`, `estudos_engenharia_bim`, projetos, orçamentos no motor Python e medições operacionais não são convertidos ou regravados. Uma nova revisão não torna automaticamente o estudo antigo válido: ele passa a exigir reconferência.

## PDF offline

Gerado pelo `app/src/pdfTemplates.js` canônico já usado nas memórias do Studio, sem fonte online ou serviço pago. Contém identificação, registro, modelo/IFC/GUID/revisão, entradas, resultados e unidades, oráculo, observações normativas, quantidades e impactos 5D, além das ressalvas de responsabilidade técnica.

Limites deliberados: exportação técnica de registros existentes, não aprovação por norma, ART, quantitativo executivo ou termo de aceite. Os relatórios PDF do orçamento oficial 5D continuam pertencendo ao motor Python existente.

## QA

- `npm test` inclui `test/p4EngineeringReport.test.js` (QTO e preço restritos à fonte, ambiguidades, negativos, revisão e PDF) e `test/p4ImpactStorage.test.js` (migração SQL.js v4→v5 sem perda).
- `npm run build --prefix app` valida React/TSX.
- Playwright `scripts/qa/reactBrowserSmoke.cjs` testa registrar a memória ligada a um GUID, reabrir e exportar o PDF.
- Gate GitHub `run-cbim-qa` somente após concluir os commits P4; não dispara a cada commit.
- Merge somente após observar resultados green para o HEAD, homologação das telas e gates Windows/IFC relevantes.
