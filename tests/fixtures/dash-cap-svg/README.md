# Independent dashed SVG cap observations

These 19 original source SVGs, binary PNGs and `observations.json` were generated with
librsvg/Cairo and ImageMagick from literal geometric constructions. The generator
imports only Node built-ins; it does not import production geometry, layout,
paint resolution or candidate collection. Original failed review files at
`/private/tmp/stz-32b-review-H8bkE3/{triangle-dash-repro,dash-repro}.json` were read
and preserved unchanged. Existing solid polygon fixtures were not regenerated.

Run explicitly with `PATH=/opt/homebrew/bin:$PATH node
tests/fixtures/dash-cap-svg/generate.mjs`. Renderer versions, SVG/binary SHA256,
local settings, alpha observations and nearest occupied boundary-pixel distances
are retained. Each local unit spans 16 pixels in a `-80 -80 160 160` viewBox.
Pixels map to `((column+.5)/16-80,(row+.5)/16-80)`. Bounds use occupied pixel
edges at alpha >=128; the radius uses occupied pixel centers. Original bounds uncertainty is one pixel (0.0625); distance/radius uncertainty
is two pixels (0.125), as in the retained solid-join oracle. Corrected circle
polygon sharp corners use two pixels (0.125) for bounds as well: the independent
wide-cap edge quantization differs by 0.0699, exceeding one pixel. This limit is
recorded separately and is never added to production bounds or hit tolerance. Tests do not invoke external raster tools.

The exact empty triangle (size 3, no fill, bevel join, 30pt border converted to
36 SVG units, named dashed pattern `[3.6,3.6]`, phase 0 and square cap) paints
`(0,-24)` and `(-6,-28)` at alpha 255. Its raster bounds are
`[-26.375,-29.6875,27,23.6875]`, with radius `30.38043289890715`. These pixel-edge
bounds agree with the original review's pixel-center limits within one pixel.
The radius-`1.8*sqrt(2)` circle with a 60pt/72-unit border gives square-cap bounds
`[-48.3125,-51.875,46.875,47]`, radius `52.69207794464933`, and alpha 255 at
`(9,-50)`. Butt and round controls stay within the circle radius plus half width.

Additional fixtures cover thin square caps, named dotted and densely dotted
patterns, explicit pattern precedence, shifted endpoints crossing corners and
closed seams, concave star corners, separate zero-on/zero-off entries and mixed
zero entries, negative/wrapped phases, and sparse circle gaps. The continuous
contour/stroke selection policy intentionally accepts dash gaps; raster paint
alone is therefore a positive oracle and a paint-bound oracle, not a complete
interaction oracle. Independent exterior negatives beyond both continuous
stroke and caps remain required.

The mandatory `point-paint-dash-caps` native scenario adds 219 artifacts to the
previous 386: eighteen responsive case records, independent source SVG/raster PNG,
selection screenshots and per-probe real ordinary/Alt pointer observations.
The two triangle runs also retain five same-node style edits (line style, cap,
explicit pattern, phase and restoration), each with source SVG, raster PNG, ordinary/Alt pointer candidate and selection
records, and a screenshot before the next edit.
The native contract checks original source, effective settings, paint enclosure,
selection radius, exact painted probes, continuous gap selection, clear prior
selection, excluded handles/overlays, candidate sets and actual cycling through
both the visibly clicked point and its overlapping control. Local probes are
mapped through the actual DOM CTM; screens use fractional translation so integral
native pointer coordinates map back to the intended local coordinate.
The original eight cases and their 95 artifacts remain required. Ten added square
cases cover exact/terminal zero dots, positive endpoints and later-zero patterns.
Each new square audit retains 1,089 grid samples against native dashed paint and a
separate continuous-solid raster with the original interior, then uses real
ordinary/Alt pointer witnesses. It is a required engine comparison, not permission
to discard valid zero entries based on Cairo's internal-zero normalization.

`corrected-circle-observations.json` and the three `*-linearized` SVG/PNG pairs
are separate corrected outputs; `generate-corrected-circles.mjs` does not write
the original observations. Dashed square-cap circles use 256 inscribed straight
edges in the production renderer and its cap geometry. The pure fixture repeats
the mathematical construction without importing production code. Records include
all 256 vertices, centerline error bound `r*(1-cos(pi/256))` (about 0.0000753r),
and maximum tangent-angle error `pi/256` (about 0.012272 radians). This fixed
count avoids renderer-specific curved-path dash interpolation and is independent
of dash lengths, phase, width and radius. Solid, butt and round circle controls
retain their native circle representation; the original circle contour interior
remains selectable. The corrected wide-cap raster bounds are
`[-48.1875,-51.75,47.3125,46]`, radius `52.70801424475219`, and `(9,-50)` remains
fully painted. The native scenario records the logical circle radius and actual
256-vertex painted contour, including the same responsive pointer transforms.

A sparse round-cap triangle (`[5,10]` local dash pattern, width 36) retains the
independent `(27,-2.5)` exterior probe. This distinguishes actual outward
semicircular caps from an incorrect full-disk extension at every endpoint.

## Large finite phases

`large-phase-observations.json` is separate from both preceding fixture sets.
Its six records retain original and corrected paint at raw TeX-point phases
`1e12`, `1e20` and `1e200`, with the empty size-3 triangle, 30pt/36-unit border,
bevel join, square caps and named dashed style. Source SVGs and PNGs live under
`large-phase/`; their hashes exactly match the independent review's retained
`/private/tmp/stz-review-production-phase-*` original and `*-canonical` outputs.
The review's original and corrected observation JSONs are copied byte-for-byte
alongside a provenance/hash manifest. Original failed geometry/bounds observations
remain readable in `review-original-observations.json`.

The independent `generate-large-phases.mjs` imports no application module. It
constructs literal vertices and stroke settings, emits `rawPhase * 1.2` for the
original and `(rawPhase * 1.2) % sum([3 * 1.2, 3 * 1.2])` for the corrected case,
and checks every source/raster hash against that retained review manifest.
Regeneration uses the same command prefix and raster tools as the other fixtures;
it never writes the original nineteen or corrected-circle three fixture pairs.
The emitted pattern components are the actual JavaScript conversion values
`3.5999999999999996`, not rounded decimal `3.6`, because a changed floating-point
period can produce a different remainder at very large phases.

The corrected emitted phases are respectively `4.800118423789293`,
`3.178929335004266` and `4.91885494459315`. Their raster bounds are respectively
`[-27.5625,-29.6875,25.8125,24.6875]`,
`[-28.375,-26.1875,28.5625,26.4375]` and
`[-27.5,-29.6875,25.875,24.5625]`. The original large SVG offsets produce different
native paint; merely reducing a separate geometric interpretation is insufficient.
The corrected renderer and layout share the signed remainder in the emitted
pattern's local units, while the saved model retains the raw phase. Raster
resolution, transforms, alpha/distance probes and uncertainty remain explicitly
recorded; these fixtures add no production tolerance or bounds padding.

## Dash endpoints exactly at polygon corners

`corner-observations.json` adds seventeen independent records without replacing the
preceding 28 source/raster pairs. The four Cartesian square cases use vertices
`(0,0),(10,0),(10,10),(0,10)`, local widths 6 and 36, square/round caps, bevel
joins and pattern `[0,10]` at phase 0. The production-local case retains the
reviewer's exact size `5.892556509887896`, 30pt/36-unit stroke and floating-point
vertices around `(+/-5,+/-5)`, with the model's explicit pattern `[0,10/1.2]`.
These five SVG/PNG pairs are byte-identical to the retained independent review
files. Both original reviewer observation JSONs, including the failed production
picking records, are copied byte-for-byte under `corner/` with a hash manifest.

The independent generator `generate-corners.mjs` uses literal settings and no
production imports. Its raster observations retain a fully opaque positive near
an extremal painted edge, targeted probes, a bounded Cartesian grid, nearest
paint distances, renderer versions, SVG/PNG hashes and the explicit 16-pixel per
local-unit transform. At width 36, Cartesian `(25,25)` is outside paint: its
boundary-pixel distance is `7.031319444101511` for square caps and
`8.504709173452081` for round caps. The production-local square's `(20,20)` and
`(25,25)` distances are respectively `7.031319444101511` and
`12.20151437834665`; all four target observations have alpha 0. They distinguish
incorrect extra outward cap quadrants from the intended six-unit allowance.

Twelve additional positive-length dash controls retain the same Cartesian square
and pattern `[10,10]`, crossing widths 6/36, square/round caps and phases
0/-.25/+.25. The exact/before/after placement is recorded explicitly. For
width 36 with square caps, at phase 0 the dash starts exactly
at a corner and `(25,25)` still has alpha 0 and distance `7.031319444101511`.
At phase `-.25`, the start moves just after that corner and the same probe has
alpha 255. At phase `+.25`, it begins just before the corner and the probe
remains unpainted. The round width-36 controls reproduce the same change at
`(20,20)`; the thin square and round controls do so at `(12,11.5)`, away from
the raster uncertainty at the exact bevel edge. This independently guards both exact-corner endpoint ownership and
the different tangent of a start in the next edge. All corner SVGs omit
`stroke-miterlimit`, retaining the native default 4 in their settings records;
bevel joins do not consult that value. Error limits remain one raster pixel for
bounds and two for boundary-pixel distances, with no production tolerance change.

`seam-observations.json` and [the seam provenance](seam/README.md) add eight
source/raster pairs for terminal positive starts, phase-clipped initial intervals
and leading-zero mixed patterns. Their 3,962 observed probes retain paint and
exterior evidence against a separately specified continuous bevel octagon. All
50 preceding source/raster pairs remain unchanged.

## Terminal-only zero-length dash on a closed path

`terminal-dot-observations.json` retains five more source/raster pairs, separate
from the preceding 45. The Cartesian square `(0,0),(10,0),(10,10),(0,10)` uses
pattern `[0,15]`, phase 5, widths 6/36 and square/round caps. Its isolated final
zero-length on-entry lies exactly at arclength 40, the closed-path seam; no dash
starts at arclength 0. The four Cartesian SVG/PNG pairs match the independent review's
`/private/tmp/stz-review-terminal-dot-valid-*` files byte-for-byte. The original
review observations, including the omitted terminal cap's failed distances, are
copied unchanged under `terminal-dot/` with a source/raster hash manifest.

The independent `generate-terminal-dots.mjs` uses literal settings, no production
geometry imports, and the same retained raster resolution/uncertainty as the
other independent polygon inputs. The width-36 square-cap probe
`(-17.96875,-17.96875)` is fully painted (alpha 255). Its earlier distance to the
incomplete interaction region was `9.96875`, greater than the six-unit picking
allowance. Tests also retain robust painted terminal probes, the thin and round
controls, finite exterior distances, and the originally reported worst probes.
The terminal dot must therefore be included even when the initial seam contains
no on-entry; it must not be discarded as an assumed duplicate of an initial cap.

The fifth case preserves the actual production square (size
`5.892556509887896`, 30pt/36-unit stroke, model pattern `[0,15/1.2]` and phase
`5/1.2`) from `/private/tmp/stz-review-production-terminal-dot.{svg,png}`.
Its local `(21,-21)` and `(22,-22)` probes both have alpha 255; explicit
model settings, original floating-point vertices and retained source/binary
hashes make this a regression for the real empty-point construction.
