# Signed ellipse traversal references

These additive references preserve PGF 3.1.11a's ordered path, separately from
all inherited references and the immutable independent review reproduction.

`generate.mjs` imports no application code. It compiles the exact retained
`fixed-box.tex` with pdfTeX (TeX Live 2026), no shell escape, and records raw PGF
soft-path tokens in `geometry.txt`. `references.json` records the engine, command,
TeX-point units, six PGF source hashes and all input/log/PDF/parser identities.
Only the raw Y coordinate is negated when parsing PGF into SVG coordinates.

The sixteen arc cases cover all four nonzero axis-sign combinations, forward
and reversed full/partial traversal, translated centers, rotation, and closure.
The two fixed-box node cases retain both the reviewed 20/8/3pt body and an empty
body suitable for native browser coverage. The empty body's inner separations
-20/7.5pt produce the same signed fitted axes (-1, 10.6066017) as the reviewed
body with -30/2pt separations. Both retain 24 independent PGF anchors.

`render.mjs` is a separate observation generator. It renders current production
paths and independent PGF-token paths with librsvg 2.63.0 at 800 × 800 pixels,
viewBox `-40 -40 80 80`. Its 90 records retain 432 SVG/PNG artifacts with hashes,
commands and pixel-mask observations. Three dashed styles cover phases -2.7,
1.3 and 0, butt/round/square caps and miter/round/bevel joins; solid and fill
controls are also retained. The production-source identities are recorded
separately from the PGF reference identities.

PGF uses cubic approximations while SVG uses analytic elliptical arcs. The
ordered geometry comparison retains the existing 0.03pt tolerance; actual
dark-pixel masks differ at at most 16 of 640,000 positions. The raster regression
allows at most 20 boundary pixels for this independent representation difference.
The explicit old-sweep and global-absolute-axis controls differ by hundreds of
pixels in every mixed-sign dashed case and fail the same geometry tolerance.
Equal bounds and total pixel counts are deliberately insufficient.

For the reviewed case, corrected production and independent PGF PNG bytes have
the original review's SHA256
`7e29b9db2533c9e41672f63cffe547232155c0dfd669f51dcd7de4ab51d39d55`.
Both contain 480 dark pixels. Restoring only the old sweep gives 298 misplaced
dark pixels, and globally taking absolute axes gives 297.

Regenerate only this additive directory:

```sh
PATH=/opt/homebrew/bin:$PATH node tests/fixtures/point-node-anchors/signed-traversal/generate.mjs
PATH=/opt/homebrew/bin:$PATH node tests/fixtures/point-node-anchors/signed-traversal/render.mjs
```

The geometry test decodes SVG arcs using independent endpoint-to-center math
and compares ordered cumulative positions and endpoint tangents with PGF cubics.
The rendering test authenticates and decodes the actual retained PNG scanlines,
then exercises the same path through live and detached settled SVG in both
ambient dimensions while preserving authored styles, coordinates, placement,
picking, save/load and both TikZ modes. Native browser/export acceptance remains
a separate parent gate.
