# CompatibilizaBIM — Manifesto cumulativo 01–50

## Entregas novas

### 46 — Project Persistence
- workspace versionado e inspecionável em diretórios;
- `project.cbim.json`, import plan, configuração, perfis, relatórios e revisões;
- gravações autoritativas atômicas (`fsync` + `os.replace`);
- reabertura, status SHA-256 e backup ZIP do workspace.

### 47 — Autosave / Recovery / Crash Safety
- sessão marcada como limpa/não limpa;
- autosave deduplicado por SHA-256;
- rotação de snapshots;
- candidatos de recuperação somente após encerramento não limpo;
- recuperação validada pelo schema CBIM antes de commit no workspace.

### 48 — Desktop Packaging
- `cbim-desktop` para criar, abrir, consultar, salvar e recuperar workspaces;
- servidor local em `127.0.0.1` servindo o CompatibilizaBIM Studio;
- API local `/api/status`, `/api/recovery` e `/api/project`;
- Studio pode salvar o CBIM revisado de volta ao workspace quando aberto pelo desktop;
- pacote portável com wheels e scripts de bootstrap Windows/Linux.

**Limite explícito:** esta entrega produz um desktop portável/instalável via Python. MSI/EXE assinado para Windows exige uma pipeline de build Windows e não é falsamente marcado como concluído neste runtime Linux.

### 49 — Customer Configuration / Offline Licensing
- configuração por cliente e installation ID gerado localmente;
- licença offline assinada com Ed25519;
- chave privada nunca precisa ser distribuída no produto;
- vínculo opcional por instalação, edição e feature flags;
- expiração, `not_before`, mismatch de cliente/instalação e assinatura inválida são rejeitados;
- CLI `cbim-commercial` para keygen, configuração, emissão, validação e pilot gate.

### 50 — First Commercial Pilot Gate
- gate formal de piloto comercial separado do Production/Scalability Gate;
- fixture/public sample nunca pode liberar piloto;
- requer ACadSharp real, 4 disciplinas, cobertura mínima, carga de revisão limitada, IFC, federação, quantitativos, persistência, recovery, desktop e licença;
- artefato desta entrega permanece corretamente **bloqueado** por falta de DWG real/cliente.

## Artefatos principais 01–50
- `artifacts/workspace-demo-01-50/`
- `artifacts/autosave-recovery-01-50.json`
- `artifacts/compatibilizabim-studio-01-50.html`
- `artifacts/demo-customer-01-50.json`
- `artifacts/demo-license-01-50.json`
- `artifacts/demo-license-public-01-50.pem`
- `artifacts/demo-license-validation-01-50.json`
- `artifacts/commercial-pilot-evidence-01-50.json`
- `artifacts/commercial-pilot-gate-01-50.json`
- `artifacts/CompatibilizaBIM_Desktop_Portable_v1.37.0.zip`
- `dist-01-50/compatibilizabim_core-1.37.0-py3-none-any.whl`
- `dist-01-50/cbim_sdk-0.3.0-py3-none-any.whl`
