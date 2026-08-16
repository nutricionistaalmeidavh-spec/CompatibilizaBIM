# Módulo de compatibilidade BIM

O pacote `CompatibilizaBIM_v1.7.0` foi criado especificamente para este software e foi incorporado sem misturar seus demais domínios.

## Reaproveitado

- motor de comparação entre dois modelos;
- modos `intersection`, `collision` e `clearance`;
- identificação por GlobalId, classe IFC e nome;
- modelo de conflitos estruturado para relatório;
- pacote Python original preservado em `modules/compatibilizabim` para uso com IfcOpenShell, viewer, relatórios e workspace desktop.

## Adaptado ao núcleo JavaScript

`src/bim/compatibility.js` fornece uma API offline leve para modelos já carregados como elementos com caixas delimitadoras (`bbox.min`/`bbox.max`). Ela não tenta substituir o IfcOpenShell: a leitura geométrica completa de IFC continua no módulo Python original.

Essa separação evita quebrar as calculadoras e permite evoluir a interface Electron para chamar o backend Python quando o ambiente tiver Python/IfcOpenShell instalados.
