# Engenharia 360 / CompatibilizaBIM

Plataforma desktop offline para gestão de obras, cálculos de engenharia e coordenação BIM. O software combina o acompanhamento operacional da obra com leitura de modelos IFC, compatibilização, quantitativos, planejamento e orçamento, mantendo os dados no computador do usuário.

## Principais recursos

### CompatibilizaBIM

- importação e pré-validação de arquivos IFC;
- identificação de disciplinas e formação de federação de modelos;
- compatibilização entre disciplinas, com regras para interferências e afastamentos;
- registro, classificação, responsáveis, prazos, comentários e histórico de pendências;
- comparação entre revisões;
- visualização local em 3D;
- relatórios de pré-validação, compatibilização e quantitativos em JSON e CSV, além de exportações de relatório e BCF quando aplicável.

### BIM 4D, 5D e medições

- extração de quantitativos IFC, com alternativa geométrica quando a propriedade não está disponível;
- orçamento 5D com composições, perdas, BDI e integração de referências SINAPI;
- importação de cronograma CSV, vínculo entre atividades e elementos IFC e simulação 4D;
- medições BIM, aprovação, exportação CSV e relatório financeiro.

### Gestão de obras e engenharia

- cadastro de obras, etapas, frentes de serviço, pendências e avanço físico;
- RDO com equipes, serviços, materiais, ocorrências, impedimentos e fotos;
- contratos, compras, contas e controles operacionais locais;
- backup e restauração da base SQLite;
- geração local de PDF;
- calculadoras de pré-dimensionamento e verificação para elementos estruturais, fundações, instalações e infraestrutura.

> Os cálculos e verificações são apoio técnico. A aprovação de projeto, a definição normativa aplicável e a responsabilidade técnica permanecem com profissional habilitado.

## Arquitetura

- `app/` — interface desktop Electron/Vite e persistência local;
- `modules/compatibilizabim/` — motor Python para IFC, compatibilização, quantitativos, planejamento, orçamento e relatórios;
- `src/` — regras de domínio e calculadoras de engenharia;
- `storage/` — schema e acesso SQLite;
- `references/` — planilhas de referência usadas para rastreabilidade e regressão;
- `test/` — testes automatizados do núcleo.

O aplicativo é orientado ao uso offline. No Electron, a base de dados é gravada em `Documentos/Engenharia360/engenharia360.sqlite`.

## Executar em desenvolvimento

Pré-requisitos: Node.js 18 ou superior e, para os recursos BIM fora do instalador, Python compatível com as dependências em `modules/compatibilizabim-requirements.txt`.

```powershell
cd app
npm install
npm run electron:dev
```

Para abrir apenas a interface Vite no navegador:

```powershell
cd app
npm run dev
```

## Gerar o aplicativo Windows

```powershell
cd app
npm install
npm run dist:win
```

O processo gera o instalador NSIS e inclui o runtime Python definido na configuração do Electron Builder. Runtimes, dependências instaladas e artefatos de release não são versionados neste repositório.

## Testes

```powershell
npm test
```

A suíte cobre cálculos, persistência e fluxos principais do núcleo. Para validar a interface, execute também:

```powershell
cd app
npm run build
```

## Limites e conformidade

As planilhas e normas de origem são mantidas para rastreabilidade. Quando uma edição normativa requer reconciliação, o sistema a sinaliza; ele não declara conformidade automática sem revisão técnica.
