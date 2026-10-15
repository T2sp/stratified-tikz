# Diamond aspect scanning references

This additive PGF 3.1.11a bundle preserves the inherited reference files. Its
generator imports no application geometry. It authenticates the installed PGF
source and engine, extracts the literal aspect setter and diamond saved-anchor
register stages, then compiles real fixed-box diamond nodes. All nineteen stages
use integer TeX scaled points. Paths and anchors use TeX points with exactly one
Y reflection into the SVG frame.

The 22 boxes contain 558 anchors: all twelve supported named anchors and fourteen
numeric directions, except the intentionally singular zero-box numeric anchors.
They include aspects .01, .03, .1, .2, .6, 1.1 and 100, nearby scanned values,
independent minima, asymmetric signed separation, negative fitted axes, odd
scaled-point body dimensions and products, empty bodies and zero axes. The native
empty-box case has independent width minimum 20pt and north anchor. Production
tests replay every register stage at unit scales 1, 1.2 and 2.7, and compare ordered
paint/anchor coordinates within the inherited .03pt/.025pt tolerances. Explicit
controls reject the preceding analytic division and PGF's different mathematical
reciprocal algorithm.

Regenerate offline with the authenticated TeX Live 2026 installation:

```sh
PATH=/opt/homebrew/bin:$PATH node tests/fixtures/point-node-anchors/diamond-aspect-scanning/generate.mjs
```

The exact command, source/engine/input/raw/log/PDF/generator hashes and inputs are
in `references.json`. `staged-upstream-source.tex` records the literal source plus
register observations; it is separate from real-node path/anchor observations.
No TeX execution or dependency is added to the application.
