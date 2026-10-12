# Integração MotorCalculoEngCivil → CompatibilizaBIM (P0/P1)

## Uma aplicação, motor canônico
- Interface única: React Studio existente. Nenhuma navegação vanilla ou segundo app.
- Python já integrado ao Electron: comando `math-study` no `cbim-runtime.exe`.
- SymPy 1.14.0 e mpmath 1.3.0 inteiramente locais; sem CDN, assinatura, Worker ou Pyodide adicional.
- Banco oficial segue SQLite (`calculos`) e guardrails de validação independentes. Não se importa IndexedDB do projeto acadêmico.

## Entregas
- P0: cadastro dos 34 itens alcançáveis por grupo, leitura amigável das grandezas, unidades explícitas e exportação/histórico originais preservados.
- P1: diagramas M/V *idealizados* para viga simplesmente apoiada sob carregamento uniforme; curvas de sensibilidade com o mesmo motor numérico existente; laboratório SymPy para derivação, integral definida, raízes e extremos.
- Estudo simbólico somente no desktop. Na prévia de navegador, a calculadora tradicional, os diagramas de vigas e a sensibilidade funcionam normalmente.

## Limites técnicos e segurança
- O backend aceita somente x e um conjunto pequeno de funções aritméticas; utiliza AST permitida, limite de tamanho, intervalo limitado e timeout de 12s no processo Electron; sem eval Python ou JS para expressões fornecidas pelo usuário.
- Diagramas não inferem automaticamente condição de contorno de elementos IFC ou da matriz global 2D/3D. A natureza idealizada é declarada em tela.
- Análise paramétrica mantém os demais parâmetros fixos e não propaga alterações para o modelo IFC, orçamento, plano de obra ou memorial aprovado.
- Grandezas são exibidas na unidade declarada pelo identificador de origem; nenhuma conversão de unidades é feita silenciosamente. Verificação dimensional/normativa não é inferida do SymPy.
- Os arquivos de biblioteca herdam licenças de seus respectivos projetos; a importação replica a abordagem matemática, não incorpora o layout, Pyodide ou recursos Cloudflare do MotorCalculoEngCivil.

## Testes e homologação
- `npm test` valida catálogo, formatação, diagramas e sensibilidade.
- `python -m unittest discover -s test -p 'test_engineering_math.py'` valida o kernel SymPy e rejeição de entrada insegura.
- `npm run build --prefix app` valida a interface React.
- Gate Windows existente compila o novo motor no runtime PyInstaller e produz instalador QA; não instalar em máquina do usuário nem fazer merge automático.
- Aprovação normativa, precisão em sistemas gerais e desempenho de modelos grandes permanecem como gates adicionais, não como declarações de conformidade.
