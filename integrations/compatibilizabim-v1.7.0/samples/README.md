# Modelos de teste

## Sintéticos — resposta conhecida

A pasta `synthetic/` contém três modelos IFC2X3 mínimos com sólidos de raio 400 mm:

- `sphere_a.ifc`: centro X = 0 mm;
- `sphere_b_overlap.ifc`: centro X = 600 mm — deve colidir com A;
- `sphere_b_clear.ifc`: centro X = 1000 mm — deve ficar separado de A.

Isso cria um teste determinístico: o primeiro par precisa produzir pelo menos um clash e o segundo precisa produzir zero.

Após instalar o IfcOpenShell, rode:

```bash
compatibilizabim-selftest
```

Ou manualmente:

```bash
compatibilizabim samples/synthetic/sphere_a.ifc samples/synthetic/sphere_b_overlap.ifc \
  --class-a IfcProxy --class-b IfcProxy --mode collision

compatibilizabim samples/synthetic/sphere_a.ifc samples/synthetic/sphere_b_clear.ifc \
  --class-a IfcProxy --class-b IfcProxy --mode collision
```

## Públicos — edifício real

Os modelos grandes não ficam dentro do ZIP. Para baixá-los:

```bash
python scripts/download_public_samples.py
```

Eles serão gravados em `samples/public/revit/`:

- `Ifc4_Revit_ARC.ifc`
- `Ifc4_Revit_STR.ifc`
- `Ifc4_Revit_MEP.ifc`

O script não baixa novamente arquivos já existentes.

## Pendências demo para exportação

`samples/issues-demo.json` contém duas pendências fictícias para testar a fase 9 sem precisar executar IfcOpenShell:

```bash
compatibilizabim-export all samples/issues-demo.json reports/demo-export --author coord@example.com
```
