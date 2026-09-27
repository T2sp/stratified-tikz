# Independent SVG polygon stroke paint observations

These 18 inputs and PNGs isolate SVG polygon paint from StratifiedTikZ's bounds
and candidate implementation. They supplement the original retained review
probes at `/private/tmp/stz-review-{miter,bevel}.{mjs,json,svg,png}`; those original
files were read and left unchanged. No PGF fixture was regenerated.

`generate.mjs` imports only Node built-ins. Its input coordinates come from the
specified regular triangle/star constructions, with fixed widths and joins; it
does not import production geometry, layout, bounds or selection. SVG paint uses
`fill="none"`, a solid black stroke, ordinary geometric scaling and miter limit
10. Each local unit spans 16 raster pixels. The renderer and pixel reader are
recorded in `observations.json` (librsvg 2.63.0, Cairo 1.18.4; ImageMagick
7.1.2-31). Regeneration, when explicitly needed, is:

```sh
PATH=/opt/homebrew/bin:$PATH node tests/fixtures/polygon-stroke-svg/generate.mjs
```

The extractor thresholds independent PNG alpha at 128 and records painted
bounds, maximum occupied-pixel-center radius, and shortest distances from each
probe to occupied boundary pixel centers. Coordinates use the explicit viewBox
`-80 -80 160 160`; pixel centers map to `((column+.5)/16-80,
(row+.5)/16-80)`. The SVG and binary PNG SHA256 identities are checked by the
registered test. Rasterization is not a test-time dependency.

Bounds have one pixel (0.0625 local unit) uncertainty. Distance/radius checks
allow two pixels (0.125 local unit), covering pixel-center quantization and
partial alpha-threshold coverage at pointed joins. A thin star miter tip
produces a 0.0894-unit discrepancy, so half-diagonal-only bounds would
underestimate that raster uncertainty. The separate analytic triangle tests
retain strict 5.9-unit hits and 6.1-unit misses; the picking tolerance remains
exactly six local units. Raster-based candidate comparisons omit only samples
whose measured distance is within the stated uncertainty of six.

The exact size-3 triangle has circumradius `3.6*sqrt(2)` and a 30pt border of
36 local units. Independent raster observations are:

| Join and probe | Actual analytic edge | Raster observation | Distance past paint |
| --- | --- | --- | --- |
| Miter `(0,28)` | bottom `20.545584412271573` | bottom `20.5625` | analytic `7.454415587728427`; raster `7.468815376282908` |
| Bevel `(0,-24)` | top `-15.454415587728427` | top `-15.4375` | analytic `8.545584412271573`; raster `8.593806817993991` |

The wide bevel top at x=0 comes from the opposite edge strip, which extends
past the apex bevel. At x=10 the exposed apex bevel face instead lies at
`-14.091168824543141`; tests cover that genuine painted face separately.
Outward miter-tip checks preserve the 36-unit extension, exceeding half-width
18. Both reported outside probes are rejected through production candidate
collection in pending and committed empty-label layouts and at display scales
0.5, 1 and 2. Screen mapping uses the production viewBox transform.

The other observations cover 1.2-unit triangle strokes; 36-unit strokes on tiny
stars with overlapping strips; 2.4-unit strokes on size-20 stars with open
concave valleys; 36-unit size-35 stars matching native acceptance; round joins;
an acute tip that exceeds miter limit 10; and repeated/near-collinear vertices.
All polygon observations are compared in both windings and with explicit
closure. The acute limit test independently contrasts the rendered bevel tip
with an allowed miter at limit 100. Disabled stroke, hollow interior selection,
circles, all-repeated vertices and retained outward corners are separate
production controls.
