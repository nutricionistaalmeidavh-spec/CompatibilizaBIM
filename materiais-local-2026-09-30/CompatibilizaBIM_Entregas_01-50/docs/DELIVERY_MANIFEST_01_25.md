# Manifesto de entrega 01–25

## 21 — CBIM Revision Diff

**Aceite:** detecta added/removed/modified e classifica alterações geométricas e semânticas. Elementos importados em revisões diferentes podem ser correlacionados pelo handle/proveniência mesmo quando o ID CBIM foi regenerado.

## 22 — Performance & Incremental Planning

**Aceite:** hashing determinístico por entidade, identificação de entidades alteradas e tiles afetados; remoções e alterações de INSERT podem forçar rebuild global de forma conservadora. Inclui benchmark sintético de 50k entidades.

## 23 — Complex Buildings

**Aceite:** um CBIM pode representar múltiplos edifícios/torres e dezenas de pavimentos com vínculos Building → Storey; motor detecta grupos de pavimentos repetitivos por assinatura semântica normalizada.

## 24 — XREF & Multi-file CAD

**Aceite:** compõe árvore de documentos CAD, aplica transformações aninhadas, preserva proveniência, evita colisões de IDs/blocos, rejeita ciclos e mantém bloco local correto para expansão posterior.

## 25 — Georeferencing & Large Coordinates

**Aceite:** coordenadas projetadas grandes podem ser convertidas para frame local e voltar ao global dentro da tolerância; CRS, origem e rotação ficam registrados no CAD/CBIM.
