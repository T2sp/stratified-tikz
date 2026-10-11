# Additive signed polygonal PGF evidence

This directory adds 54 fixed boxes and 1,386 independently observed anchors to
the unchanged original 172-box/4,925-anchor/11-failure and signed-basic
8-box/192-anchor bundles. No previous expected values are regenerated.

The first 36 boxes parse the exact retained read-only reviewer inputs and raw PGF
observations: all 18 empty cases and 18 targeted body cases, with regular polygon,
legacy square/triangle, star, isosceles triangle and dart, each at outer separation
0/+3/-3 pt. The complete original case artifacts, manifests, failing production
results and reproduction scripts are under `review/`. The model-path review
contains exact saved 2D/3D JSON and both TikZ modes. `review/artifact-hashes.json`
authenticates every retained byte; `references.json` authenticates that manifest
and the parsed observations. Failing production results are provenance only and
are never oracle inputs.

The 18 fresh boxes add body/minimum fitting, radius/length transitions, all
declared indices, rotation, incircle and stretch, star ratio/height and mixed-sign
inner/outer radii. They include all supported standard, text-side and numeric
anchor categories. One separately retained star boundary independently causes a
PGF reciprocal-of-zero error and remains diagnosed; it is not a fabricated anchor.

Twelve direct raw math observations distinguish PGF's signed reciprocal branch
from abs-then-reciprocal, and divide-then-atan from atan2 reconstruction. Four dart
boxes also retain the actual upstream fitted lengths, half tail separation,
offset and fitting reciprocal inputs/results, including sequential minimum
scaling. Trace wrappers record PGF state after its original operations; they do
not replace fitting or arithmetic. The negative height-minimum dart retains the
actual `-159.85501` reciprocal input and `-0.0062` result.

All lengths are TeX pt. PGF raw positive-Y-up is reversed exactly once in parsed
SVG-frame observations. Production is additionally checked at 1.2 SVG units/pt.
The registered suite retains 0.025 pt anchor and 0.03 pt contour tolerances and
checks signed-radius, separation-sign, fitting-angle and geometric-miter negative
controls with the original paint envelope unchanged. This fixed-box evidence
does not claim MathJax/font or native browser acceptance.

Regenerate only this additive bundle with:

```sh
PATH=/opt/homebrew/bin:$PATH node tests/fixtures/point-node-anchors/signed-polygonal/generate.mjs
```

The generator imports no application geometry, math or support table. It checks
all retained input/raw/compiler/PDF/reproduction/model artifact hashes and all
seven authenticated upstream source hashes before invoking pdfTeX
3.141592653-2.6-1.40.29 (TeX Live 2026), PGF 3.1.11a, with
`-no-shell-escape -interaction=nonstopmode -halt-on-error`. Exit status, full
input/options, compiler output, raw geometry and generator hashes accompany the
records. Normal tests read checked-in evidence and need neither TeX nor librsvg.
