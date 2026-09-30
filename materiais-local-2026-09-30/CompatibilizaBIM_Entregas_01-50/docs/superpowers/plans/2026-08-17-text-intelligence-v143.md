# Text Intelligence v1.43 Implementation Plan

**Goal:** Parse and spatially associate CAD text annotations with MEP entities so the recognizer can systematically use diameter, material, system, height/elevation, and vertical-direction hints without yet reconstructing Z geometry.

**Architecture:** Add a dedicated `mep.text_intelligence` module that normalizes/parsable CAD text and indexes text spatially with Shapely STRtree. `MepEvidenceEngine` consumes the nearest relevant annotations as corroborating evidence and carries parsed height/elevation/vertical hints into CBIM element properties. v1.43 stores 3D hints but does not alter element Z; Z propagation remains a later stage.

**Tech Stack:** Python 3.11+, Shapely 2.x, Pydantic CAD models, CBIM SDK.

## Tasks
1. Add failing parser tests for metric/inch diameter, materials, systems, `h=`, levels/cotas, and sobe/desce/prumada.
2. Add failing association tests proving nearest relevant text wins and distant text is ignored.
3. Implement parser + STRtree text index.
4. Integrate text facts into `MepEvidenceEngine` and hydraulic/fire output properties.
5. Add project metadata diagnostics for text facts and unassociated semantic text.
6. Bump version to 1.43.0, update docs, run full Core/CBIM tests, build wheel and portable desktop, verify extracted ZIP.
