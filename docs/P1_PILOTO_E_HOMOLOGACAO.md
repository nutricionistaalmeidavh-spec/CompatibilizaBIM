# P1 — protocolo de piloto acompanhado e homologação

**Estado atual:** preparado para execução, **não homologado com usuário externo**. A aprovação não pode ser presumida com base no commit ou em testes históricos.

## Público e objetivo

Projetistas e coordenadores BIM que recebem DWG real e precisam de modelo revisável, quantitativos e IFC. O piloto deve observar uma tarefa real de ponta a ponta: instalar, ativar, importar, reconhecer, revisar, salvar, reabrir, exportar e conferir no visualizador/Revit.

Os resultados históricos do BARRILETE e do QUA-HID são baseline válida de versões anteriores. O workflow Windows P1 testa ambos na versão 2.1.0 e registra comparações, mas não substitui a revisão humana da precisão semântica.

## Sessão acompanhada

1. **Máquina limpa:** Windows 10/11 x64, sem Python, Node ou SDK .NET instalados. Instalar o preview assinado ou internamente distribuído. Comprovar que o executável abre e que os runtimes embutidos estão acessíveis. Não usar uma instalação antiga como prova.
2. **Licenciamento offline:** testar ativação válida para instalação/cadastro, licença expirada ou adulterada e licença com recurso ausente; confirmar bloqueio claro sem internet. A chave privada fica somente com o emissor, nunca no instalador.
3. **Importação:** entregar ao usuário um DWG real, sem indicar a localização da ação na interface. Observar se reconhece a disciplina, resolve dependências/XREFs e diferencia importação parcial de erro.
4. **Geometria e semântica:** solicitar que localize objetos de confiança alta/baixa, verifique pisos, cotas Z, tubos/conexões e decida se corrige, confirma ou rejeita. Medir verdadeiros/ falsos positivos em amostra conferida manualmente, não por reconhecimento_rate.
5. **Revisão e persistência:** revisar elementos, salvar, fechar e reabrir. Confirmar que classes, decisões, fontes e status não se perdem; restaurar revisão anterior mantendo a nova disponível.
6. **Interrupção e recuperação:** interromper uma sessão com autosave, reabrir e recuperar em cópia de trabalho. Erros devem exibir diagnóstico e caminho para continuar, sem limpar trabalho válido.
7. **Exportação e inspeção:** abrir IFC gerado em visualizador externo e, se disponível, Revit. Conferir posições, unidades, redes, conectividade, pavimentos, Z e propriedades contra o DWG original. Assinalar diferenças e evidências.
8. **Uso da experiência:** perguntar ao usuário o que acabou de acontecer, o que ainda precisa de revisão e como retomar no dia seguinte, sem mencionar nomes dos botões.

## Registro mínimo (sem divulgar arquivos de clientes no GitHub público)

- Identificador anonimizado do DWG, SHA-256, disciplina, versão CBIM, data da execução e hardware.
- Relatórios validation.json, timings.json e comparativo de baseline, sem expor desenhos proprietários.
- Lista de elementos analisados manualmente com classificação encontrada × classificação correta, falso positivo/negativo, Z e coordenadas.
- Tempo por etapa, travamentos, reinicializações, bloqueios, perda de dados e falhas corrigíveis.
- Observação de usuários sem orientação: conclusão da tarefa, ações equivocadas, dúvida de estado e capacidade de retomar.
- Comprovação de licença offline, instalador limpo, abertura e exportação IFC.
- Autorização do titular para uso dos dados e armazenamento seguro de evidências.
- Evidência distinta para arquitetura, estrutura, hidráulica e incêndio quando se pretende liberar a suíte completa.

## Gate programático do Core existente

O módulo FirstCommercialPilotGate exige evidência real de cliente, execução nativa ACadSharp, quatro disciplinas, cobertura de importação >=95%, reconhecimento elegível >=80%, revisão manual <=25%, IFC, federação, quantitativos, persistência, recuperação, desktop, licença e >=100 objetos reais. Esses são limiares do código existente e devem ser confrontados com qualidade visual/semântica, não usados como substitutos.

Preencher o modelo JSON em docs/pilot/P1_PILOT_EVIDENCE_TEMPLATE.json com evidências realmente coletadas (inicialmente tudo bloqueado). Avaliar com:

~~~powershell
python -m compatibilizabim_core.commercial.cli pilot-gate --evidence .\docs\pilot\P1_PILOT_EVIDENCE_TEMPLATE.json --output .\p1-pilot-gate.json
~~~

Resultado de saída 3 significa piloto bloqueado e **não** deve ser contornado. Não marcar campos como true sem evidência. A aprovação comercial exige também instalação Windows em máquina limpa, assinatura do executável e termo de aceite do usuário.

## Ordem de validação

A. CI Linux (Node + Python + Studio) → B. CI Windows (DWGs reais + runtime + NSIS) → C. máquina limpa → D. 1º piloto assistido → E. correções, reteste e revisão de aceitação. A fase C–E depende de execução humana real e não está concluída apenas por este commit.

**Restrições:** nenhum merge automático, deploy, atualização remota, geração de segredos, chave privada ou modificação da main.
