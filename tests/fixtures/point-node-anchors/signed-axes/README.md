# Additive signed rectangle/ellipse axes evidence

This directory supplements the original 172-box / 4,925-anchor / eleven-failure
Phase 32D inventory without modifying it or any 32C reference. `review/` retains
the review's complete input, raw PGF paths/anchors, compiler output, manifest and
historical failing production reproduction, byte for byte. The review's artifact
hashes and all seven installed PGF source hashes were checked before compilation.
The reproduction files are historical production evidence, not oracle inputs.

The eight new fixed boxes cover empty strongly negative ellipse/rectangle,
nonempty 20/8/3pt bodies with small negative minima, mixed-sign fitted axes and
different outer separations that cross both axes' signs. All 192 observations
come from actual PGF 3.1.11a under pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026).
The generator imports no production solver or support table. It authenticates
the retained sources and engine before running:

```sh
PATH=/opt/homebrew/bin:$PATH node tests/fixtures/point-node-anchors/signed-axes/generate.mjs
PATH=/opt/homebrew/bin:$PATH node --test tests/geometry/pointNodeAnchorReferences.test.ts
```

The actual compiler command is `/Library/TeX/texbin/pdflatex -no-shell-escape
-interaction=nonstopmode -halt-on-error fixed-box.tex` in a fresh temporary
directory. `fixed-box.tex` is complete input; `compilation.txt` is full command
output; `geometry.txt` retains raw PGF path tokens and anchors. `references.json`
records the successful exit, command, engine, source/input/raw/compiler/generator
hashes and independently parsed observations. `STZ_PDFLATEX` can select an
identical authenticated engine.

Raw coordinates are TeX pt in PGF's positive-Y-up frame. Parsed observations
reverse Y exactly once for SVG's positive-Y-down frame. Rendering uses 1.2 SVG
units per TeX pt; the tests convert scaled observations back to TeX pt before
applying the unchanged 0.025pt anchor and 0.03pt contour tolerances. No CSS px,
PDF bp or 72pt/in conversion is involved.

For an empty box with inner x/y separation -100pt and minima -160pt, the fitted
axes and PGF east/north are signed -80pt. Its absolute painted envelope is still
80pt in each direction. A 20/8/3pt box with inner separation -30pt and minima
-2/-5pt has axes -1/-2.5pt: negative minima dominate more negative padded axes.
The mixed case uses inner x/y separation -30/+2pt and minima -2/-5pt; adding
outer x/y separation +2/-20pt crosses the x axis from negative to positive and
y from positive to negative while preserving the painted contour.

Compass, text-side and numeric anchors are retained separately. Ellipse named
diagonals use eccentric angles; numeric directions use PGF's signed comparison
and radial normalization branches. Rectangle numeric results can lie beyond its
absolute envelope for negative saved axes. Controls reject absolute-valued
fitted axes paired with correct paint, wrong-sign anchors, compass-for-numeric
substitution and loss of text-side baseline offsets.

This is independent fixed-metric geometry evidence. Production rendering,
picking, save/load and TikZ tests are separately registered; actual native
controls, Alt cycling and downloads require fresh cumulative parent acceptance.
