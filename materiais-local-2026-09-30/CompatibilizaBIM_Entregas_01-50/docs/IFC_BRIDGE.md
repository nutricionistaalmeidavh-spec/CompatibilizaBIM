# IFC Bridge 1.2.0

A saída é IFC4 STEP. Nesta entrega são materializados geometricamente:
- IfcWall
- IfcColumn
- IfcBeam
- IfcSlab
- IfcDoor
- IfcWindow
- estrutura espacial Project/Site/Building/Storey

Para preservar IDs CBIM, confidence, source_refs e relações sem perdas, o arquivo inclui um comentário STEP com payload CBIM base64. Leitores IFC ignoram comentários; o `IFCBridge.import_file()` usa o payload para round-trip exato.

Importação genérica de IFC de terceiros não é aproximada: exige o backend IfcOpenShell, que ficará isolado atrás da mesma interface.
