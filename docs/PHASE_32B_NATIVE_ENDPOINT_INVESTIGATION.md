# Native dash endpoint continuation

32B remains incomplete until matching full parent verification and independent
review pass. This continuation preserves the isolated zero-dot, solid-join,
effective-style and visibility work. 32C/32D remain deferred.

## Evidence boundary

The supplied pre-prompt identity is
`b4a31d7b7a4a0b99937396a987a9c833f7d973fbdcb61e531ab142934fc3995c` on
`0cf597f1a71b249e73374b354d69409ba4c51979`. The actual starting checkout is
clean `beae63a78adb1e65608f6cce7b71da66e3cf5033`, which records the preceding
17 changed files and this prompt update. Its fingerprint is
`190d70b81a940bb20b194c2f88d2ae04913d8ffdb5f118cbd3dc7203b84ec30d`.
No reset or restart was performed. Neither starting identity verifies later edits.

The parent `epviae` run used Node v26.9.0 and Chrome 154.0.8037.57. Its before
and after fingerprints both match the supplied pre-prompt identity. Tests
(4,286), build, diff check and label-assets passed. Free-labels failed in
`point-paint-dash-caps`; 14 of 16 groups completed, paint/import was incomplete,
and `settled-SVG-export-standalone` did not execute. There were no page errors.
All 18 App entries ran (14 passed, four failed), followed by all 19 supplemental
entries (15 passed, four failed). This is progress, not complete acceptance.

The first error is the eleventh App entry, terminal-zero at scale .5:
`audit-outside` records ordinary candidates `['control','p']` instead of
`['control']`. Selecting the overlapping control did not make this correct.
The preserved command log and per-action records, not the terminal stack alone,
establish which entries and actions ran.

The existing exact-zero case now passes both responsive scales, with no grid
mismatches and actual ordinary/Alt actions. Its layout radius
32.526911934581186 encloses the measured 32.482717760757026 radius. Both internal
zero variants, raw/exact, reverse winding, diagonal dots, and near-corner/seam
controls passed. These results supersede the earlier lack of native evidence
for those particular cases without changing any historical fixture bytes.

## Endpoint findings

Each App square audit has 1,089 cells. Terminal-zero has 45 false candidates
at each scale; positive-corner has 76 missed candidates at each scale.
The four supplemental failures reproduce these and add zero-off (208 misses)
and positive-before-corner (39 misses). Bounding enclosure alone did not detect
these errors: terminal-zero layout maxX was 23 while painted maxX was 18.

The terminal pattern `[0,15]`, phase 5, paints only the two dots strictly before
the end of the closed path. Synthesizing a terminal-only dot at arclength 40
adds a false square at the seam. A zero-on dot genuinely present at the initial
seam is a separate case and retains its full square/disk geometry.

For a positive dash starting exactly at a vertex, its outgoing edge supplies
the start-cap direction; its ending cap belongs to the incoming edge. A zero
off entry still separates capped positive subpaths in the retained raster.
The former solid early return and zero-off coalescing erased those endpoints.
No coordinates, raw pattern entries, phases or comparison tolerances are changed.

The terminal witnesses `(21,-21)` and `(22,-22)` are now explicit negative
regressions: raster alpha zero, native exclusion, and paint distances about
8.03131 and 9.03130. `(22,-18)` has paint distance 6.44705 and solid distance
8.48540, beyond six units plus .14 uncertainty. All three remain required
pointer witnesses. The independently painted `(-22,-22)` remains positive.

The positive-corner `(20,20)` exterior assertion was disproven by alpha 255,
native containment and the actual click including `p`. It remains a positive.
The replacement `(-22,-30)` is excluded by both observers, with paint distance
7.03132 and solid distance 16.97062. Additional painted `(16,-22)` and
`(22,-22)` witnesses detect the separate missing-cap geometry error.

## Raster and containment disagreement

The original zero-off grid has 24 opaque 3-by-3 raster cores with native stroke
containment false; positive-before-corner has 30. Their raw observations remain
unchanged. For example, the latter's `(16,-22)` has alpha 255 and paint distance
zero, containment false and old geometry distance about 7.0711. Exact-positive
and both original App positive-corner grids have no such disagreement.

The supplemental source uses literal vertices, fill none, width 36, square
caps, bevel joins and miter limit 10. It observes containment on a mounted
128-pixel SVG at unit scale, while decoding a standalone clone at 16 pixels per
local unit. Raw and parsed coordinates, computed dash settings, path length and
CTM are retained. The disagreement is localized around the initial/terminal
seam, where raster paint retains a boundary cap and containment describes a
joined stroke. These square grids cannot distinguish an initial cap from a
terminal cap: their unions with the other caps agree at every sampled point.
This identifies the conflicting region; it does not establish
that one observation universally represents live Chrome paint.

An initial-cap hypothesis agreed with every square sample but was disproven by
the retained triangle's live dash-phase edit at both responsive scales:
its raster radius is 28.3999408560, the original layout radius is 28.4264503931,
and either an initial or terminal extra seam cap raises the radius to
30.4021047655. Merely changing cap orientation does not repair this counterexample.
That generic seam change was removed. The triangle regression retains the
native observations and prevents adding either unpainted extent.

The three independently corroborated corrections are retained. Replaying the
complete historical supplemental grids removes all terminal and exact-positive
mismatches and reduces zero-off's 208 omissions to 24. The 24 remaining zero-off
omissions and 39 positive-before-corner omissions are explicitly unresolved;
their 24 and 30 opaque-core/native-exclusion contradictions remain visible.
The joined seam is preserved until actual live paint can establish the cause.
This is an implementation limitation, not a passed geometry acceptance test.

Acceptance requires independently captured visible SVG pixels and
new actual-App pointer witnesses. It preserves the clone raster, native
containment, opaque-core definition, and genuine background controls. A known
containment disagreement can only be accepted with explicit live-paint
corroboration; absence or contradiction of that evidence fails the gate.
The child's direct Chrome launch is restricted (SIGABRT followed by cleanup
EPERM), so actual live corroboration remains a parent gate, not a result inferred
from Skia/Cairo source or synthetic data.
The available Computer Use tool also denied access to Google Chrome with
`Computer Use was not approved to use Google Chrome`. No permission change or
workaround was attempted. A verification launched before the triangle
counterexample was found is retained as exploratory history; it cannot verify
the final corrected checkout.

## Preservation and completion

Bounds, radius, pending/committed picking and immutable exports still consume
the shared cap geometry. Original contour interiors and continuous-stroke
selection through gaps remain. Picking tolerance six, decoration allowance six
and raster uncertainty .14 remain separate. Bounded arithmetic families retain
short intervals and large/wrapped phases without dash-count iteration.

The original failures remain byte-identical. Added registered regressions use
literal analytic constructions and authenticated native historical data;
synthetic policy fixtures remain explicitly synthetic. The matrices retain
per-entry status, complete grids, failure continuation, the first error, bounded
captures and owned cleanup. A failed or incomplete matrix cannot pass the
scenario. Fresh-process policy loading and file-backed fixture transport remain.

The minimum remains 16 groups and 29 named point scenarios, with 856 required
artifacts: 386 earlier artifacts, 301 App dash artifacts and 169 supplemental
artifacts. All prior 705 remain required. There are now 22 App case/scale entries
and 14 complete square audits, each with 1,089 cells. The 21 supplemental entries
retain the original 19 plus an oblique seam and uninterrupted closed-path
control, each with a complete grid and visible captures at scales 1 and 16.
New App zero-off and positive-before-corner entries require responsive and
magnified live screenshots at both .5 and 1.5 App scales. Pixel records are bound
to the retained PNG bytes and dimensions; missing, stale or malformed live
evidence fails cumulative verification.
Four additional screenshots retain actual ordinary/Alt negative actions at
`(-6,-34)` and `(0,-32)` for the triangle's dash-phase edit at both scales. Each
requires native transparent paint, native exclusion, paint distance beyond the
tolerance and an independent lower bound on continuous-stroke distance. These
controls prevent the rejected generic seam-cap change from returning.

Visibility diagnostics, deliberately different pre-reload settings, 2D/3D and
inline/standalone restoration, history/payload/revision assertions and immutable
downloads are preserved. Later passes do not prove the cause of historical
`UThawr`. Earlier `YAt03b`, child startup restrictions and unfinished `vaZYVU`
remain separate evidence boundaries.

Final code/tests/docs precede verification. The final identity, preservation
manifest, executed checks, required artifact inventory and independent review
are recorded externally at `/private/tmp/stz-phase32b-endpoint-followup/`.
The authorized parent must run `PATH=/opt/homebrew/bin:$PATH node
scripts/automation/run-phase.mjs 32B verify` on that exact identity, including
both complete browser reports and the final settled SVG group. Any later edit
requires matching verification again. No commit or push is authorized while
required verification or review is unsuccessful.
