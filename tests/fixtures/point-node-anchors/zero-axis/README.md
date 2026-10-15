# Additive authenticated zero-axis path evidence

This directory preserves the independent review's failing zero-axis probes in
`review/` byte for byte, including input, raw PGF paths, compiler output/log/PDF,
production and reference SVG/PNG, saved 2D/3D models, live/settled producer
results, both TikZ modes, and the original reproduction scripts. The retained
manifest authenticates every artifact explicitly. Those records establish the
original invisible SVG stroke/visible PGF stroke mismatch and production picking
probe, **not native browser click acceptance**.

`generate.mjs` imports no production geometry, math, parameter resolver or
support table. It authenticates pdfTeX 1.40.29/TeX Live 2026, compiler-loaded PGF
3.1.11a and eight PGF source hashes, then invokes:

```sh
PATH=/opt/homebrew/bin:$PATH node tests/fixtures/point-node-anchors/zero-axis/generate.mjs
```

The recorded compiler command uses `-no-shell-escape -interaction=nonstopmode
-halt-on-error fixed-box.tex` and exits zero. The complete fixed-box dimensions
and options are retained in `fixed-box.tex`. Five empty ellipse cases cover
zero-x, zero-y, both-zero and each negative surviving axis. Six direct PGF arc
cases cover 45→135° turning extrema, reversed traversal, negative surviving
axes, rotation, and an extra revolution before the partial sweep. Raw geometry
is TeX pt with positive Y up; parsing reverses Y exactly once to the SVG frame.
Production preview uses 1.2 SVG units per TeX pt. Old 32C, 172-box, signed-basic
and all other predecessor references remain untouched. Anchor/contour
tolerances remain .025/.03pt.

`render.mjs` consumes the independently generated PGF tokens and separately
obtains current emitted production paths. It invokes installed librsvg 2.63.0
to retain 37 actual renderer records: 25 complete-node cases across butt/miter,
round/round, square/bevel+dashes, round/round+dashes and zero-area fill; plus 12
partial-arc solid/dashed controls. Each SVG/PNG is hashed. Full-node PGF reference
paths are unmodified. Their black-pixel masks and extrema match production
exactly; only boundary antialias levels differ by at most 5/255 due to PGF fixed
point arithmetic. No TeX/librsvg runtime dependency is added; registered tests
require and inspect the retained SVG and decoded PNG scanlines.

For partial arcs, Cairo suppresses the interior of a single solid stroked cubic
with coincident endpoints, even when its control points produce a retracing
excursion. The unmodified `pgf-raw` SVG/PNG is retained and explicitly separated
from `pgf`: the latter splits the raw cubic at derivative roots by independent
de Casteljau interpolation, preserving geometry, order and length. Normalization
and raw provenance are recorded in `render-results.json`. The original dashed
partial PGF raster already retains the excursion. These are renderer controls
for the shared arc helper, not new native shape-layout acceptance.

```sh
PATH=/opt/homebrew/bin:$PATH node tests/fixtures/point-node-anchors/zero-axis/render.mjs
```

The production branch emits only collapsed-axis lines at ordered quarter
boundaries and any intervening extrema. It preserves complete retracing,
closure, dash phase, cap/join behavior and zero-area fill. It retains signs on
the surviving axis; nonzero ellipse arc commands, magnitude-based sampling,
.005-unit precision and the 2048 sample budget are unchanged. Degenerate turning
endpoints also enter the sampled path, so painting and picking describe the same
traversal.

Registered geometry/rendering tests authenticate all retained bytes, compare
actual emitted paths, traversal length and signs, inspect actual stroke/fill
pixels and extrema, reject omitted/shortened/absolute-axis controls, and cover
2D/3D validation/version-2/raw units, live/pending/settled placement, both TikZ
modes, active work-plane projection, current owner/source/font/filter/lock guards,
ordinary candidates and cycling, and genuinely outside exclusion. Their
fixed-metric/pure picking observations are distinct from the required fresh
cumulative native browser/download acceptance.
