# Verification — cumulative deliveries 01–45

Verification scope adds product workflow behavior without weakening the prior CAD/DWG/CBIM gates.

Checks include:
- Import discipline detection and unknown-discipline blocking.
- Duplicate-storey configuration rejection.
- CAD profile learning excludes automatic/unreviewed recognition.
- Conversion report blocks export while automatic/rejected elements remain.
- Standalone Studio contains all five workflow surfaces and no external JavaScript dependencies.
- Existing cumulative Core and CBIM suites remain green.
- Demo artifacts are generated from a valid CBIM project and reload successfully.
- Wheel install and `cbim-product` entrypoint are checked from a clean target directory.

Production DWG evidence remains separately gated by the real-project rules from deliveries 36–40.

## Fresh results
- Core: **66/66 PASS**, coverage **90%**.
- CBIM Python SDK: **6/6 PASS**, coverage **95%**.
- `compileall`: PASS.
- Core wheel 1.32.0: PASS.
- Clean target install: PASS.
- Installed `cbim-product` plan workflow: PASS.
- Product artifact reload (CBIM/plan/profile/report): PASS.
- Studio HTML parsing: PASS.
- Embedded JavaScript syntax (`node --check`): PASS.
- Persistent CBIM computed-field regression: PASS.
- Credential/private-key pattern scan: PASS.

A headless browser executable is not installed in this runtime, so browser rendering itself is not claimed as executed. The Studio is self-contained, has no external JS dependency, and its embedded JavaScript was syntax-checked independently.
