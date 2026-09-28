# Entrega CompatibilizaBIM v1.1.0

## Fase 1 — Coordenação BIM

Implementação funcional completa no desktop: federação/viewer, clash detection, issues e revisões.

## Fase 2 — Monetização

Implementados Quantitativos BIM e Orçamento 5D, com catálogo de composições, perdas, BDI, curva ABC e relatórios.

## Segurança de cálculo

- medidas geométricas de fallback são identificadas e não entram no orçamento automaticamente;
- múltiplas quantidades do mesmo tipo (ex.: NetArea/GrossArea) não são somadas silenciosamente;
- grupos sem mapeamento ficam explicitamente como não precificados;
- o catálogo demo não é SINAPI e não deve ser usado como referência comercial.

## Limitação de validação deste ambiente

Os testes que exigem a biblioteca nativa IfcOpenShell continuam ignorados neste runtime. A implementação real usa o adaptador IfcOpenShell e precisa ser certificada em máquina com a dependência nativa e modelos IFC reais antes de uso em produção.

## Próxima etapa oficial

07. Planejamento BIM 4D. FluxoDRE permanece fora do escopo até a etapa 09.
