# Independent generalized closed-seam observations

These eight source/raster pairs preserve the corresponding SVG and PNG bytes from
the independent reviewer matrix at
`/private/tmp/stz-review-endpoint-matrix/`. The original 144-case matrix and its
failed results remain unchanged there. `reviewer-observations.json` retains the
eight original result rows, the complete matrix hash and every source/raster hash.
Corrected observations are recorded separately in `../seam-observations.json`.

Coverage is `[10,15]` at phase 10, `[15,10]` at phase 10, and `[0,5,10,15]` at phases
0 and 20, each with square and round caps. All use the literal Cartesian square
`(0,0) (10,0) (10,10) (0,10)`, width 36 and bevel joins. The source viewBox is
`-30 -30 80 80`, rendered at 1280 × 1280: 16 pixels per local unit. No screen or
model transform is applied. Paint means alpha at least 128. Bounds use painted
pixel centers with uncertainty 1/16 local unit; paint-distance/radius comparisons
allow 2/16 local unit. Raster extrema and fully opaque extension probes are
retained along with independently empty exterior probes.

`generate.mjs` contains no production imports. It recreates each literal SVG and
uses librsvg/Cairo and ImageMagick to reproduce the raster and observations. It
requires every SVG and PNG hash to match the retained reviewer bytes. Its
independent continuous-interaction oracle is the explicit bevel octagon
`(-18,0) (0,-18) (10,-18) (28,0) (28,10) (10,28) (0,28) (-18,10)`.
The manifest preserves these vertices and each probe's independently calculated
distance to that octagon. An exterior miss requires distance greater than six
units plus raster uncertainty from both actual paint and the continuous octagon;
dash gaps inside the intended selection neighborhood are never negative controls.

Run `PATH=/opt/homebrew/bin:$PATH node tests/fixtures/dash-cap-svg/seam/generate.mjs`
with the renderer versions recorded in the manifest. This regenerates only the
eight pairs and their corrected observations; it does not rewrite the original
failure matrix or the retained reviewer excerpt.

The broader matrix also exposed later zero-on entry behavior for `[5,5,0,15]`
and `[10,0,0,15]`: the retained librsvg/Cairo output matches zero-elided patterns.
Those observations remain external and are not treated as universal SVG cap
semantics. They have not been confirmed in Chrome. This bounded fixture set covers
the requested generalized seams and preserves that remaining engine-specific
limitation explicitly.
