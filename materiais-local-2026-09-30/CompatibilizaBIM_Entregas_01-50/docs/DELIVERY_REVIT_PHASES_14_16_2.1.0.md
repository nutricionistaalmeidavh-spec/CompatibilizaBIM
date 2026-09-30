# CompatibilizaBIM / CBIM 2.1.0 — Fases Revit 14–16

## 14 — Plugin CBIM para Revit 2027

O plugin genérico usa o `cbim-revit` para analisar DWG pelo ACadSharp/CBIM Core e gerar um `CBIM.RevitBuildPlan` determinístico. O caminho nativo não depende de IFC. Níveis, paredes, pisos e instâncias de família resolvidas são criados pelo host genérico. Pipe/Fitting são deliberadamente deixados para o plugin hidráulico.

## 15 — Integração com Plugin Biblioteca

O contrato `CBIM.RevitLibraryManifest` liga os projetos sem fundi-los. O Plugin Biblioteca deve manter `%LOCALAPPDATA%\CBIM\Library\manifest.json` e roots locais. O resolver valida classe semântica, subtipo, Revit 2027, DN/ângulo/conectores/sistema/material/fabricante quando disponíveis e rejeita caminhos fora das roots. O pacote contém somente um manifesto de exemplo sem RFA proprietário.

## 16 — Plugin Hidráulica

O plugin hidráulico procura automaticamente o plano mais recente do CBIM, executa o refinamento topológico e cria `Pipe` nativo. Fittings usam os conectores dos pipes e as factories do Revit para elbow, tee, cross e transition/reducer. Fittings CBIM já reconhecidos recebem dependências dos pipes incidentes; mudanças de direção sem fitting geram fitting sintético; near-miss permanece diagnóstico.

## Fluxo

```text
Revit 2027
  ↓ DWG
Plugin CBIM → CBIM Core → Revit Build Plan
                           ↘ Plugin Biblioteca (famílias/tipos locais)
                            ↘ Plugin Hidráulica → MEP nativo/connectors
```

## Segurança/licenças

- Autodesk RevitAPI/RevitAPIUI são referenciadas da instalação local e não são redistribuídas.
- Famílias de fabricante não são incluídas no pacote.
- A Library aceita somente RFA local em root declarada.
- O ACadSharp bridge continua processo separado.

## Limite de validação desta entrega

O ambiente de empacotamento não possui Autodesk Revit 2027/RevitAPI nem .NET SDK configurado para compilar contra essas DLLs. A camada Python e os contratos/fontes C# são verificáveis aqui; a compilação final dos hosts C# deve ser feita no Windows que possui Revit 2027 usando `build_revit_2027.ps1`.
