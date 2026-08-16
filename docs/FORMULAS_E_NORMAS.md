# Auditoria de fórmulas e normas

## Escopo

As fórmulas dos módulos novos foram transcritas das planilhas originais e verificadas por testes automatizados de sanidade (valores finitos, limites básicos e oráculo independente da viga biapoiada). A suíte atual possui 62 testes aprovados.

O Formula Genius foi acionado para uma segunda conferência, mas a conexão do aplicativo solicitou reautenticação. Portanto, não foi usado como fonte de alteração automática.

## Resultado

Foram auditados os módulos de bacia de detenção, bloco sobre duas estacas, bomba centrífuga, calhas e condutores, capacidade de estaca, curva IDF, laje nervurada, ligação parafusada, orçamento/cronograma, pilar metálico, rede de esgoto, reservatório, sarjeta/boca de lobo, tubulação de água fria e viga metálica.

Não foram feitas alterações cegas nas equações: a planilha é uma referência de pré-dimensionamento e a aplicação mantém o aviso de conferência técnica.

## Controle normativo

O registro `src/norms/registry.js` mantém a reconciliação de versões:

- NBR 6118:2014 nas planilhas: catálogo oficial já referencia ABNT NBR 6118:2026; fórmulas estruturais ficam marcadas para reconciliação antes de uso normativo.
- NBR 8800:2008 nas planilhas: substituída pela ABNT NBR 8800:2024; fórmulas metálicas ficam marcadas para reconciliação.
- NBR 5626:2020, NBR 6122:2019 e NBR 10844:1989 permanecem como referências cadastradas.
- NBR 9649:1986 exige confirmação das exigências locais antes de declarar conformidade.

Até obter o texto oficial completo e a edição adotada pelo responsável técnico, o software não declara conformidade normativa; ele apenas identifica a versão declarada, a versão de referência e o status de reconciliação.
