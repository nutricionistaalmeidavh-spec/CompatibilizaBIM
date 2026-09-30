# Arquitetura acumulada até a entrega 10

```text
DXF
 │
 ▼
DXFImporter
 │
 ▼
Canonical CAD
 │
 ▼
Geometry Engine
 │
 ▼
Topology Engine ── nós / arestas / faces / gap repair
 │
 ▼
Architecture Recognition ── wall / column / door / window / space
 │
 ▼
CBIM
 │
 ├── Levels & 3D ── storey / elevation / height
 │
 ├── Structural ── beam / slab / foundation-role / opening
 │
 ▼
CBIM Project
 │
 ▼
Reviewer ── confirm / reject / edit / add / remove / undo / redo / export
```

## Fronteiras de produto

`cbim-sdk` é o contrato independente. `compatibilizabim-core` consome esse contrato, mas não depende do Revit. O SDK .NET é outro consumidor do mesmo CBIM e servirá posteriormente ao plugin Revit.

## Invariantes

- Todas as unidades internas são metros.
- IDs CBIM são persistentes dentro do documento.
- Proveniência CAD é preservada em `source_refs`.
- Elementos reconhecidos carregam `confidence` e `review_state`.
- Computed fields como `Wall.length` não são persistidos no JSON CBIM.
- Revit não é uma dependência do Core.

## Large-building foundations (entregas 21–25)

```text
Revision A CBIM ─┐
                 ├─ CBIM Diff ──> change set / issues / revision UI
Revision B CBIM ─┘

CAD sources / XREF tree
        ↓
XrefComposer (namespaces + transforms + provenance)
        ↓
Projected global coordinates
        ↓
LocalCoordinateFrame
        ↓
Canonical CAD with small local coordinates
        ↓
Geometry / Topology / Recognition
        ↓
CBIM Site → Building/Tower → Storey
        ↓
Core Gateway / IFC / Quantities

Entity hashes + spatial tiles
        ↓
IncrementalPlanner
        ↓
affected regions or conservative global rebuild
```

The Core does not require Revit for any of these operations. Revit remains a separate CBIM client.
