# CBIM Catalog Brasil — Core 1.41.0

## Objetivo
Usar conhecimento de catálogos reais para confirmar e qualificar componentes já reconhecidos pelo Core, sem transformar catálogo em gatilho de MEP e sem escolher fabricante automaticamente.

## Famílias iniciais
- Amanco Wavin: Água Fria, PPR, FlowGuard CPVC, PEX, Esgoto, QuickStream, CPVC Fire BlazeMaster, Elétrica e Gás.
- Tigre: Linha Soldável, Aquatherm, PPR, Esgoto, famílias de incêndio e elétrica.
- Krona: água fria, esgoto, PPR, CPVC e elétrica; o adapter registra o valor especial dos pares públicos DWG 2D/DWG 3D/Revit.
- Astra: PEX e sistemas hidráulicos.
- Fortlev: água fria e reservatórios.
- Docol: metais/aparelhos como conhecimento de equipment/fixture.
- Incêndio: Victaulic, Viking e Reliable como adapters de conhecimento.
- Elétrica: Schneider Electric e Siemens como adapters para o futuro recognizer elétrico.

## Regra de segurança
`CatalogAdvisor` retorna candidatos e score. `CatalogEnricher` somente grava `catalog_manufacturer`, `catalog_line` e `catalog_item_id` quando existe fabricante explicitamente preferido/especificado.

## Direitos e distribuição
O pacote contém apenas metadados canônicos de famílias e links de origem. Não redistribui arquivos RFA/DWG proprietários de fabricantes. O usuário pode baixar bibliotecas oficiais diretamente do fabricante e futuros importers poderão transformar manifests locais em itens do catálogo.
