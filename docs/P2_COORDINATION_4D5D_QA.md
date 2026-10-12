# P2 — Coordenação F4, quantitativos/orçamento F5 e planejamento/medição F6

**Estado:** entregue na branch de implementação e sujeito aos gates CI. Homologação humana, precisão geométrica e conferência externa de BCF ainda são testes separados.

## Arquitetura — sem motores duplicados
- Electron segura a superfície React canônica; valida operações `bim:p2` e limita escritas a `Documentos/Engenharia360/BIM/studies/<id>`. O preload de revisão autenticado em loopback **não recebe** este IPC.
- O comando `cbim-runtime.exe p2` e `compatibilizabim.p2_workflow` reutilizam `modules/compatibilizabim/quantities.py`, `budget.py`, `schedule.py`, `simulation4d.py`, `measurements.py`, `measurement_financial.py`, `issues.py` e `exports.py`.
- SQLite v3 preserva registros anteriores, adiciona identidade multmodelo/proveniência da análise e `bim_issue_events` auditável. Arquivos IFC fonte, quantitativos, preço, orçamento, cronograma e medições são armazenados em cache/provas locais do estudo; não são transferidos para um serviço remoto.

## F4 — N-modelos e BCF
1. Crie/abra o estudo e selecione dois ou mais modelos **do mesmo formato**. Todos os pares são efetivamente processados. Para IFC, exige motor IFC real; JSON é rotulado `manifesto_bbox`.
2. Interseção/colisão/afastamento aceitam tolerância/afastamento em **metros**. Nenhum fallback misto ou conclusão de "zero conflitos" quando o IFC não pôde ser processado.
3. Os conflitos recebem identidade composta do par + GUIDs e evidência do conteúdo/revisão; uma decisão anterior só é transferida se a evidência coincidir. Na revisão alterada o status reabre; conflito não observado **não vira automaticamente resolvido**.
4. Registre situação, responsável, prazo, justificativa e comentários. Alterações são persistidas transacionalmente no SQLite com trilha `bim_issue_events`.
5. Gere **BCF 3.0** apenas a partir de IFC analisado pelo motor geométrico. CSV/PDF de pendências podem ser produzidos a partir de outras evidências rotuladas. A abertura interoperável num leitor BCF externo fica pendente.

## F5 — GUID → QTO → custo
- Clique **Extrair QTO do IFC**. A função usa IfcOpenShell nativo e `QuantityEngine`; por padrão, `geometry_fallback=false`. Não atribui preço nem metragem baseada em aparência do React. Duplicidades de GUID entre fontes distintas são bloqueadas.
- Importe um JSON local de catálogo com fonte, competência, composições e mapeamento por tipo/quantidade. Unidades de uma composição precisam ser compatíveis; grupos ambíguos ou sem preço aparecem como **não precificados**.
- Orçamento mostra subtotal **somente dos grupos mapeados**, BDI e origem/competência. Exportação CSV, JSON e PDF usa o motor Python. Não afirma SINAPI oficial ou custos de terceiros quando os insumos não foram fornecidos.
- Ao substituir IFC/QTO com medições já existentes, recusa a operação para evitar corrigir retroativamente quantidade aprovada sem revisão explícita.

### Exemplo de formato, sem preços cadastrados
```json
{
  "schema_version": 1,
  "currency": "BRL",
  "source": "PREENCHER: tabela própria ou SINAPI obtida legalmente",
  "reference_date": "AAAA-MM",
  "provenance": {"uf": "SP", "competencia": "AAAA-MM", "source": "PREENCHER"},
  "bdi_percent": 0,
  "compositions": [],
  "mappings": []
}
```
**Não é uma tabela operacional**: faltam composições e mapeamentos. O sistema não preenche valores por conta própria.

## F6 — CSV → cronograma → GUID → medição
- CSV usa `activity_id,name,start_date,end_date,predecessors,discipline,storey,composition_code`. Datas ISO AAAA-MM-DD. Ciclos são detectados; uma importação inválida restaura o cronograma anterior.
- Vinculação GUID↔atividade exige quantitativo IFC verificado e impede que um objeto fique simultaneamente em atividades distintas. Os avanços reais carregam data de registro.
- Simulação por data: progresso previsto x real, desvio e curva S derivados do motor `Simulation4D`. Porcentagens de atividades não são custos pagos.
- Medição por GUID/quantidade específica, competência e percentual **acumulado**. `MeasurementService` desconta somente avanços anteriormente aprovados e impede redução do acumulado. Aprovação exige identificação do responsável; rejeição exige justificativa.
- `FinancialMeasurementEngine` cruza apenas medições aprovadas com preços inequívocos do 5D, preservando linhas sem composição como **não valorizadas**. Pago/recebido continua independente e não é inferido.

## QA sem instalar no computador pessoal
- P0 Node+Python, CI de migração SQLite, federação N e regras de IPC, testes Python de orçamento/medição/BCF.
- P1 React + Playwright + segurança de loopback, build Windows com `p2 status` no runtime empacotado e DWG real de regressão.
- O teste Windows com DWG real não homologa precisão 4D/5D com usuário; exemplos reais com quantitativos/BCF ainda exigem confronto técnico humano.
