# CompatibilizaBIM Studio — publicação React

## Aplicação única
- `app/index.html` é o **único** ponto de entrada HTML e monta React.
- A navegação `AppShell` reúne obras, operação, finanças, RDO, cálculos, estruturas, estudos BIM, BIM de obra e histórico, usando o armazenamento canônico.
- A revisão CBIM usa o mesmo entry React (`?surface=review`) e a mesma janela Electron. O servidor Python local exige cookie de sessão e token efêmero, tem guarda de origem e não recebe o preload SQLite.
- `app/src/main.js`, `bootstrap.js`, `rendererMode.js` e módulos DOM Vanilla foram excluídos. Nenhum carregamento de Vanilla ou escolha de renderer está disponível no aplicativo empacotado.
- CSS e formulários da interface são componentes React; a matemática, validação, viewer e análises reutilizam as fontes originais sem fork de motor.

## Dados existentes, sem troca de contrato
- Banco: `Documents/Engenharia360/engenharia360.sqlite` no Windows; armazenamento web `engenharia360-db-v1` (sem alteração).
- SQLite: tabelas e migrations existentes; `obras`, `rdos`, `historico_obra`, `documentos_obra`, `bim_modelos`, `bim_analises`, `bim_projetos` e workspaces do CBIM continuam nos diretórios originais.
- Importar backup mantém contrato `versao: 1`. A leitura de documentos foi expandida por consulta condicionada à obra, sem migração nem duplicação.
- Operações e revisões não sobrescrevem workspaces legados e preservam auditoria pelo `WorkspaceStore`.

## Paridade por área
| Área | Rotas e operações React |
|---|---|
| Obras | carteira, indicadores, etapas, pendências, materiais, documentos originais e histórico |
| RDO | edição, aprovação, fotos, emissão PDF e exclusão confirmada |
| Financeiro | lançamentos, folha, DRE, contratos, fluxo medido/pago por frente |
| Operação | frentes, subfrentes, checklists, medições, contratos/aditivos, compras e orçamento |
| Cálculos | catálogo canônico, oráculo independente, persistência, PDF, JSON, CSV e DXF |
| Estruturas | pavimentos, nós e cargas, barras, análise 2D/3D e viewer |
| BIM | estudos autônomos e vinculados à obra, DWG→IFC, importação IFC/JSON, clash, viewer, resolução, pendências, JSON/CSV, histórico |
| Revisão | fontes CAD, configuração, revisão humana, perfis, exportações, snapshots/recuperação no React |

## Gates de merge
- `npm test`: regressão Node com invariantes de entrada única e compatibilidade do banco.
- `npm run build` (Vite): React e interface de revisão com entry único.
- Regressão Python Core/SDK, segurança do servidor e semântica do fluxo DWG.
- Browser smoke Playwright/Chromium de navegação, criação de obra, cálculo, operação, RDO e histórico, com screenshots do QA.
- Instalador Windows NSIS via GitHub Actions, com artefato e sem publicação automática.
- **Não mergir se qualquer check falhar.** O instalador não apaga dados de documentos na desinstalação.

## Infra e licenças
O núcleo é **R$ 0, self-hosted e open source**, sem API externa de execução. A verificação de licença comercial offline é opcional e explícita (`CBIM_STUDIO_LICENSE_MODE=commercial`); padrão `free`. A conversão DWG empacotada e a revisão Studio usam a mesma política: sem licença no núcleo gratuito; assinatura e recursos verificados apenas no modo comercial. Ver `docs/F0_FREE_CORE_POLICY.md`.
