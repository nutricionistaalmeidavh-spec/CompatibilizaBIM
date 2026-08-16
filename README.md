# Engenharia 360 — núcleo inicial

Este diretório é uma implementação isolada para iniciar a transformação das
planilhas de engenharia em software, sem alterar os projetos existentes.

## Módulos implementados

`src/calculators/vigaBiapoiada.js` reproduz a estrutura de cálculo da
`Planilha_Viga_Biapoiada_Completa.xlsx`, incluindo:

- esforços solicitantes;
- flexão e armadura longitudinal;
- cisalhamento e estribos;
- comprimento de ancoragem;
- flecha em ELS-DEF;
- estabilidade lateral e verificações gerais.

As unidades dos campos seguem os nomes da planilha: metros, kN/m, cm, MPa e
mm. O retorno é organizado por blocos para ser consumido por uma futura API,
tela web ou relatório de memória de cálculo.

`src/calculators/insumosConcreto.js` reproduz a planilha de insumos pelo
método da massa unitária, calculando cimento, areia, brita, água, sacos de
cimento e estimativas de volume para compra/transporte.

Também estão integradas as calculadoras de viga por flexão, laje em uma e duas
direções, pilar, sapata, escada e muro de arrimo. Cada uma mantém seus próprios
metadados, resultados e verificações para permitir revisão técnica isolada.

## Obra 360 e RDO

`src/domain/obras.js` define o cadastro de obras, etapas ponderadas,
pendências, status e resumo de progresso. `src/domain/rdo.js` define o
Relatório Diário de Obra com clima, equipes, serviços executados, materiais,
ocorrências, impedimentos, fotos e observações.

As funções são puras e retornam novos objetos. Isso mantém as regras
independentes do armazenamento e prepara a integração futura com SQLite,
API e sincronização em nuvem.

## Aplicativo offline

`app/` contém a primeira interface local do Engenharia 360. Ela usa SQLite
compilado em WebAssembly, salvo como base64 no `localStorage`, e inclui:

- cadastro e seleção de obras;
- painel Obra 360 com avanço, etapas, RDOs e pendências;
- criação de RDO sem internet;
- exportação e importação de backup completo;
- geração local de PDF do último RDO;
- arquivos do `sql.js` servidos localmente, sem CDN.

Quando executado pelo Electron, o banco é salvo fisicamente em
`Documentos/Engenharia360/engenharia360.sqlite`. No navegador puro, o
`localStorage` continua sendo usado apenas como fallback de desenvolvimento.
Antes de salvar uma memória de cálculo, o resultado passa por um oráculo
independente e por invariantes numéricos.

Para executar em desenvolvimento:

```powershell
cd "C:\Users\vh_al\Desktop\Projetos\Engenharia360\app"
npm run dev
```

Para gerar a distribuição offline:

```powershell
npm run build
```

O resultado fica em `app/dist`, incluindo o WebAssembly necessário para abrir
o banco sem conexão.

## Executar os testes

```powershell
cd "C:\Users\vh_al\Desktop\Projetos\Engenharia360"
npm test
```

Os testes comparam os valores principais com os resultados armazenados na
planilha original e preservam cenários de alerta, como ancoragem insuficiente
e flecha excessiva.

## Próximas calculadoras

Depois da validação deste motor, as demais planilhas entram como calculadoras
independentes com o mesmo contrato de entrada, saída, verificações e
metadados normativos. As planilhas originais permanecem como referência de
regressão e não são sobrescritas.
