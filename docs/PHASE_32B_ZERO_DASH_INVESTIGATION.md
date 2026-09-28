# Zero-length native dash cap correction

This follow-up preserves the completed 32B changes and the visibility diagnostics.
It addresses the retained Chrome `YAt03b` failure. Phase 32B is still incomplete
until fresh native verification and independent review succeed on one final
checkout. Phase 32C/32D remain deferred.

## Observed failure and numeric representation

The original ninth dash entry, `square-exact-zero` at scale `.5`, used empty ready
source, square size `5.892556509887896`, disabled fill, 30pt black border,
explicit `[0, 10 / 1.2]` overriding solid line style, phase zero, rect cap and
bevel join. Its emitted SVG has width 36, pattern `0 10`, square caps and miter
limit 10. The original points string is retained exactly:

```text
5.000000000000001,-5 -5,-5.000000000000001 -5.000000000000002,5 5,5.000000000000002
```

Chrome 154.0.8037.57's parsed point list is `(5,-5),(-5,-5),(-5,5),(5,5)`.
The raw double-precision edge lengths are `10,10,10.000000000000002,
10.000000000000002`; their cumulative endpoints in the existing arithmetic are
`10,20,30,40`, just like the parsed coordinates. Thus the representation
difference does not explain this reproduction. No epsilon, coordinate rounding,
pattern perturbation or normalization of zero entries is introduced.

At 16 pixels/local unit, the original selection radius was
`26.419689627245816` and raster radius `32.482717760757026`. Both original
declared bounds and raster bounds already enclosed `[-23,-23,23,23]`.
The full 1,089-cell grid records 829 expected hits, 252 misses and eight uncertain
cells, with 96 omitted hit candidates (16 of these fully painted core samples).
The failed entry's top-level `probes` is empty: its ordinary/Alt clicks did not
run. Copies of the seven original SVG/PNG/JSON files and their authenticated
manifest are in `tests/fixtures/dash-cap-native-original/`; they are failed
historical evidence, not a corrected native run.

## Correction and independent regression

The former geometry represented a zero-on vertex with an incoming half-cap and
an outgoing half-cap. This omitted part of the full zero-length native square.
`dashCaps.ts` now distinguishes isolated dots from oriented positive-length
endpoints. Isolated square dots have a full upright square; round dots have a
full disk. Edge ownership still locates their centers. Bounds, selection radius
and cap distance use the same families; the normal shared layout/picking/export
path consumes these results. No bounding box replaces the hit oracle.

For the retained square, four 36-unit squares centered at `(±5,±5)` independently
give the union `[-23,23]²`, radius `sqrt(23²+23²) = 32.526911934581186`.
The registered reproduction compares every retained cell to this literal
analytic region and to production distance/pending/ready App candidates.
All 1,081 certain native outcomes agree; the eight uncertain cells remain
recorded and also receive an analytic comparison. Fully painted missed samples
must have zero cap distance before any picking tolerance is added.

The invalid `(20,20)` exterior witness is now an explicit opaque painted
positive, alongside `(-22,-22)`. Its replacement `(-22,-30)` is native-excluded,
transparent, and independently about `7.0313194441` from paint and
`16.9706202929` from the continuous stroke. Fresh native pointer checks require
both scales. The raster uncertainty remains `.14`; selection decoration remains
six units; picking tolerance remains exactly six local units. These three
quantities are separate.

Dot families retain bounded arithmetic progressions. Upright-square distance
checks the finite stationary points and feature transitions of the translating
rectangle against neighboring progression members. It never visits every dash.
Existing extreme-period/subnormal scheduling, effective-style layout matching,
positive endpoints, solid joins and the 256-edge dashed circle contour remain.
Raw model paint, full emitted precision and immutable SVG/TikZ intent are retained.

## Engine distinction and remaining native questions

Original librsvg/Cairo files remain unchanged. Cairo's split-corner and oriented
zero-line observations are not universal SVG expectations. Tests keep those
observations labeled and use a separate literal geometric oracle where the new
zero-dot policy differs. Synthetic verifier fixtures validate policy only.

Current upstream Skia explains the upright-dot rule: `SkContourMeasure_segTo`
emits a degenerate line for equal parameters and `SkStroke::preJoinTo` supplies
an upright normal when that line has no direction:

- [SkContourMeasure.cpp](https://raw.githubusercontent.com/google/skia/main/src/core/SkContourMeasure.cpp)
- [SkStroke.cpp](https://raw.githubusercontent.com/google/skia/main/src/core/SkStroke.cpp)
- [SkDashPath.cpp](https://raw.githubusercontent.com/google/skia/main/src/utils/SkDashPath.cpp)

The Chrome version's [DEPS](https://raw.githubusercontent.com/chromium/chromium/154.0.8037.57/DEPS)
identifies Skia `2466dcf3937437e217e7f284afe0e1aae15891ce`; those exact pinned
source files were unavailable to the investigation. The diagonal rule is
source-informed, not claimed as newly measured native acceptance. The retained
axis-aligned square alone cannot distinguish upright from tangent-oriented full
squares. Fresh diagonal/corner/near-seam observations are therefore mandatory.

Current upstream source also raises questions about terminal-only zero dots and
positive starts exactly at vertices. Existing terminal and positive controls
remain required. In particular the previously unexecuted
`square-positive-corner` `(20,20)` exterior conflicts with even the existing
helper's positive endpoint region; it is explicitly a pending native question,
not a validated negative. It has not been silently moved. A failed native case
must retain its evidence and prevent acceptance.

## Expanded gate and preserved visibility evidence

The original 18 App case/scale entries keep their live edits, trusted ordinary
and Alt clicks, cleared selections, overlay exclusion, overlap controls and ten
complete square grids. Two new exact-zero positive probes add four screenshots.
The supplemental literal-SVG mechanism matrix adds 19 cases and 96 artifacts,
with 20,691 ordered cells, raw and parsed coordinates, native path length,
browser identity, local CTM, model/effective settings, raster resolution and
uncertainty. It covers raw/exact vertices, near corners/seams, winding, diagonal
zero dots, zero-off/mixed patterns, positive endpoints, butt/round/solid controls.
Native raster/containment observations precede production geometry comparisons.
Its pure zero-on cases also require cap-distance agreement, so the intentional
continuous-stroke region cannot hide an incorrect dot shape.

The cumulative gate still requires 16 groups and 29 point scenarios. It now
requires 705 artifacts, preserving the original 386 and all 219 prior dash
artifacts. Missing/malformed artifacts and incomplete/failed matrices remain
rejected. Fresh-process policy loading and file-backed fixture transport remain;
there are no retained multi-megabyte JSON closure copies, dependency additions,
global deadline/concurrency changes or retries.

`YAt03b` also supplies both 3D modes' trusted sorting `false→true` and visibility
`true→false` on the same document/control identities, then full restoration of
sorting false, visibility true and theta 41. Inline revision advances `4→5`,
standalone `5→6`; both 2D iterations pass. Its 76 available control captures have
no dropped samples/events or diagnostic errors. None of this proves the cause
of the historical `UThawr` scrolling timeout; the separately corrected optional
monitor race remains a different issue. Visibility code and diagnostic bounds
are unchanged by this correction.

Final tests, strict TypeScript, targeted lint/syntax/diff results, browser startup
limitations, binary-aware checkout identity and independent review are recorded
outside the checkout in `/private/tmp/stz-phase32b-zero-dash-handoff/`.
Finalization precedes verification; later results are external to avoid changing
the verified identity. Child startup restrictions are not native passes. The
authorized parent must run `PATH=/opt/homebrew/bin:$PATH node
scripts/automation/run-phase.mjs 32B verify`, inspect both browser reports and
the terminal settled-SVG group, and obtain fresh review before any commit/push.
