# Validação cega do fluxo de engenharia — BIM → medição → RDO → financeiro

## Estado da evidência

Este documento é um protocolo para **teste real com engenheiros**, não um relatório de entrevistas executadas. Os testes automatizados do GitHub Actions validam integridade e rotas do código, não demonstram descoberta espontânea dos controles por profissionais.

## Condições

- Perfis: engenheiro de coordenação BIM e engenheiro de execução/medição, sem treinamento nos novos botões.
- Ambiente: aplicativo desktop com base SQLite de ensaio, estudo BIM federado e obra relacionada. Não utilizar projetos reais; cópia anonimizada e restaurável.
- Dados de ensaio: lote aprovado de 5 m, medição aprovada de 4 m na mesma competência e unidade; um RDO no mesmo mês; um lançamento financeiro previsto no mesmo mês; compra vinculada a despesa de valor diferente.
- O mediador não ensina rotas, não aponta controles nem dá dicas. Pode pedir ao participante que descreva sua interpretação, sem corrigir o caminho.

## Tarefas entregues ao participante (sem pistas de interface)

**Tarefa A.** “Neste estudo, existe uma diferença entre a quantidade verificada no modelo e a quantidade registrada na obra. Descubra qual é a diferença, confira o documento de origem e retorne ao ponto da análise onde começou. Explique por que os números diferem, caso as evidências permitam.”

**Tarefa B.** “Encontre evidências de campo do mesmo período da medição e determine se o sistema comprova que elas correspondem ao mesmo serviço.”

**Tarefa C.** “Encontre os valores aprovados na obra e os valores financeiros registrados para o período. Diga quais deles representam uma medição, uma conta, um pagamento ou um recebimento confirmado e quais relações ainda não foram comprovadas.”

**Tarefa D.** “Existe um pedido de compra com uma despesa associada e valores ou status distintos. Descubra a divergência, consulte o lançamento original e retorne à conferência.”

## Observação objetiva

Para cada tarefa registre: ponto de partida, primeiro controle escolhido, número de desvios de rota, possibilidade de voltar sem perder contexto, identificação correta da unidade e do sinal de diferença, interpretação correta de “aprovado ≠ recebido”, comportamento diante de filtro fora da competência e mensagens de ausência ou referência inválida. Registre fala e ações reais com consentimento; não estime tempos, sucesso ou confiança antes do teste.

## Aceitação técnica e humana

- O código não duplica medições, lançamentos ou vínculos. No máximo cria referências explícitas com aprovação e auditoria já existentes.
- Navegação para item fora do filtro preserva o filtro e os totais, com aviso visível; não mistura obra ou estudo.
- Referência removida ou inválida deve resultar em mensagem de recuperação, nunca valor simulado.
- Sucesso de interface exige teste real sem direcionamento: participante encontra a divergência, sabe interpretar evidência temporal versus vínculo técnico e retorna à origem.
- Registrar achados e correções antes de marcar a experiência como homologada. Nenhum sucesso humano foi medido nesta implementação.
