# Phase 32B Targeted Fix Prompt: Match polygon stroke bounds and picking to visible joins

## Environment and scope

Work on `phase/32b-color-opacity-outline`. Inspect status and preserve all
current production, documentation, package, browser/policy and test changes,
including the 68 untracked paint-value PGF fixture and regression files.
At this prompt update HEAD is `a7f2d153a8ebe36879572621083c1aa7e7c29244`.
The accepted parent verification and independently reviewed checkout match
this pre-prompt fingerprint:

```text
51f57223704b6de91222612111c519751e790483750c9be1f9baea25e04e0c01
```

This identifies the tree before this prompt edit. Recompute final identity
including tracked changes, untracked files and binary bytes after corrections.
Do not reset, discard or restart the existing implementation.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Fix only the remaining Medium production defect: wide polygon borders have
bounds and exterior picking regions that disagree with their visible miter
and bevel joins. Preserve completed paint/import uncertainty and override-intent
work. Keep strict TypeScript, small testable geometry helpers, existing
dependencies and 32A behavior. Keep 32C/32D deferred.

## Accepted verification and remaining review finding

The matching parent verification passed all five commands, including both
required browser commands:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-AsZusl/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-AsZusl/05-check-free-labels/artifacts/free-labels-evidence.json
/private/tmp/stz-32b-independent-review/results.json
/private/tmp/stz-32b-independent-review/parent-evidence-audit.json
```

The review accepts 16 cumulative groups, 27 required point scenarios and
281 required artifacts on Chrome 154.0.8037.57, with no page errors.
Before/after identities match the reviewed checkout, including untracked files.
Independent Node v26.9.0 tests passed 3,937 cases with no failures/skips.
Build, diff, strict production/fixture/changed-test TypeScript and 40 script
syntax checks passed. Focused lint found only reproduced baseline debt of
40 errors and four warnings, unchanged from accepted 32A revision `595139d`;
repository-wide lint was not run. The existing build chunk warning remains
nonblocking. Retained PGF/PDF evidence was inspected without fresh TeX compilation.

Independent review returned `needs_changes`, with zero Critical, one Medium
and zero Low issues, and `ready_to_commit: false`. Native acceptance is complete
for the reviewed tree. The blocker is the confirmed polygon stroke/picking
defect below, not missing browser evidence or another imported-paint failure.

## Confirmed reproductions and failure mechanisms

Inspect and preserve the existing production probes and independently
rasterized SVG evidence before editing:

```text
/private/tmp/stz-review-miter.mjs
/private/tmp/stz-review-miter.json
/private/tmp/stz-review-miter.svg
/private/tmp/stz-review-miter.png
/private/tmp/stz-review-bevel.mjs
/private/tmp/stz-review-bevel.json
/private/tmp/stz-review-bevel.svg
/private/tmp/stz-review-bevel.png
```

Both probes use an empty triangle of size `3`, disabled fill and an enabled
solid `30pt` border. The existing conversion gives a stroke of `36` local SVG
units. The model point is at the origin; probe coordinates below are relative
to its projected center. Keep the existing six-local-unit hit tolerance.

| Join | Local probe | Actual painted edge | Distance beyond paint | Current result |
| --- | --- | --- | --- | --- |
| Miter | `(0, 28)` | bottom `20.5455844123` | `7.4544155877` | selects the node |
| Bevel | `(0, -24)` | top `-15.4544155877` | `8.5455844123` | selects the node |

Both probes must be rejected because they exceed the tolerance. The bevel
example is thick enough for the stroke of the opposite edge to affect the
painted extent; an apex-only calculation is not a sufficient oracle.

Two separate implementation choices cause the mismatch:

1. `polygonMiterJoins()` in `src/rendering/svgPointNodeLayout.ts`, around line
   54, creates triangles for both `[1, -1]` offset signs at every corner.
   A synthetic inward miter can protrude beyond the actual stroked polygon
   when the border is thick. These vertices affect `paintedBounds`,
   `anchorClearanceBounds`, `selectionRadius` and `miterHit`.
2. `collectPointCandidate()` in `src/rendering/svgHitTesting.ts`, around line
   1174, also accepts points within `stroke / 2 + 6` of the original polygon
   contour, regardless of join style. This rounded expansion admits points
   outside a bevel stroke's true six-unit neighborhood. Removing only the
   synthetic inward miters leaves the bevel defect unresolved.

The SVG paint already supplies the requested join and miter limit `10`, with
ordinary geometric scaling. Existing tests protect an outward triangle miter
apex but miss these bottom-miter and top-bevel probes. Fix the geometry used by
bounds and picking; do not change the requested paint to match the old hit region.

## Required targeted correction

1. Represent or calculate the actual polygon stroke region using edge strips
   and the appropriate join geometry. Select joins from local turn direction;
   handle both convex corners and concave star corners rather than adding both
   offset wedges or assuming every corner has the same turn. Account for
   overlapping thick strokes and the renderer's miter-limit behavior.
2. Derive polygon stroke extents and exterior hit distance from the same correct
   geometry. Remove synthetic vertices from painted/clearance bounds and radius
   calculations, and remove the join-independent rounded expansion that causes
   bevel false positives. Keep any intentionally conservative broad-phase
   bounds separate from final hit acceptance; a bounding box is not an exact
   hit oracle.
3. Measure the existing six-unit tolerance from the actual stroke region in its
   established local coordinate space. Preserve genuine outward miter tips,
   bevel edges and positive near-border hits. Do not shrink the tolerance,
   clamp to the original polygon bounds, cap supported border widths, switch
   join styles or special-case the two probe coordinates.
4. Preserve the established selection behavior inside the original contour,
   including hollow nodes. This task corrects exterior false positives; it does
   not redesign transparent/interior selection or opacity policy. Keep circle
   behavior, label/body geometry, normal/Alt cycling, layer/visibility rules,
   locking and candidate ordering intact.
5. Keep layout and picking consistent for pending and committed label geometry,
   including empty labels. Audit consumers of the corrected bounds/radius for
   selection decoration, attached-label clearance and export/capture framing.
   Preserve normal responsive scaling and the existing width conversion; map
   native screen probes into the same geometry space instead of changing units.

Prefer a focused, deterministic geometry correction without new dependencies.
Keep finite behavior at degenerate/near-collinear edges and miter-limit cases;
no NaN/Infinity, unbounded intersection work or unrelated rendering rewrite.
Keep existing supported round-join behavior covered as a control. Dashed-border
or transparent-node interaction redesign is outside this finding's scope.

## Registered regressions and native acceptance

Add registered geometry/layout/picking regressions in the appropriate existing
suites or register new files in `package.json`. Cover:

- The two exact empty-triangle probes with disabled fill, solid `30pt` border
  and size `3`. Assert rejection through production candidate collection and
  correct stroke bounds, while independently checking the actual paint extent.
- Positive points on genuine miter tips and bevel edges, and probes just inside
  and just outside the six-unit allowance. A fix that rejects painted corners
  or merely narrows all hit regions is insufficient.
- Thin and wide strokes, concave star corners and overlapping thick edge strips.
  Exercise relevant turn directions/winding in any general polygon helper,
  acute miter-limit behavior and finite degenerate-edge handling. Compare the
  resulting region to independent SVG rendering rather than copying the new
  helper's output into expected values.
- Disabled stroke, circle/round controls, existing contour-interior selection,
  pending/committed layouts and geometrically scaled display. Preserve tests
  that require an actual outward miter extension beyond half the stroke width.

Extend native point-click acceptance to cover the supplied outside-border
probes and concave star corners with thick empty-node borders. Use production
selection and real pointer actions; clear earlier selection and exclude drag
handles or overlays before measuring results. Include ordinary clicks and
relevant Alt cycling with an overlapping control candidate so a stale or
spurious candidate cannot be hidden by the selected result.

Retain SVG inputs, independent raster observations, coordinate transforms,
paint/join/width settings, measured distances, screenshots and observed
selection/candidate results for passing and failing controls. Verify legitimate
border/within-tolerance hits as well as outside misses. Do not use the corrected
bounds or candidate helper as its own oracle, inflate distances to easy misses,
force clicks, substitute direct selection mutation or remove a failing scenario.

The existing `point-contour-boundaries-cycling` coverage uses nonempty text and
default borders; it does not substitute for these cases. Integrate the new checks
into required cumulative acceptance, not only an optional standalone probe.
Preserve current groups/scenarios and artifacts; extend policy/registered
regressions as needed so reports omitting the new assertions cannot claim the
new coverage. Obtain fresh native evidence on the final corrected tree.

## Preserve completed work

Keep all imported paint corrections: executable recognized values use the
shared ordinary/dependency guard; execution uncertainty remains sticky through
nested styles, retained mutation lists, reload and preset reapplication;
ordinary invalid literals retain field-specific recovery; explicit recorded
local edits remain authoritative. Keep raw source and external semantics
without executing input or appending untouched uncertain paint in either TikZ
mode. Preserve source grammar, handler boundaries, the atomic 512-event limit
and all prior independent PGF references, including `paint-value-execution/`.
Do not regenerate them to repair SVG stroke picking.

Preserve independent paint/opacity/dimming, immutable SVG capture, exact raw
JSON/CRLF, cloning/clipboard/history, detached provenance cleanup, the bounded
100-entry history, 2D/3D semantics and free/inline-label behavior. Keep the existing
App geometry/ownership diagnostics, bounded waits, native scroll deadline,
pointer assertions and five geometry fault controls. Retain seven App → SVG →
App transitions, three continuity controls and 13 artifacts, the directory
scenario and 11 artifacts, and six responsive downloads with 91 artifacts.

The current accepted minimum is 16 cumulative groups / 27 required point
scenarios / 281 required artifacts. New coverage must supplement that baseline.
Keep the runner's 60-second fixture deadline, owned-process cleanup, failure
retention, fresh-process verifier loading and transitive dependencies. Do not
weaken policy or native assertions to pass this correction.

## Verification, documentation and review

Read `AGENTS.md`, paired 32B implement/review prompts and current
`docs/PHASE_32B_IMPLEMENTATION.md`, plus relevant rendering/geometry documentation.
Document the real join geometry and tolerance contract, both original failures,
corrected bounds/picking behavior and independent/native results. Keep changes
confined to this finding and necessary regressions/documentation.

Run focused registered tests, applicable strict production/fixture/test
TypeScript, changed-script syntax, targeted lint and `git diff --check`.
Run `npm test` and `npm run build` sequentially because they share asset
preparation. Separate reproduced baseline lint debt and the build chunk warning
from new failures; do not perform unrelated cleanup.

The AsZusl report is accepted for the reviewed pre-fix tree. Subsequent production
changes need fresh matching verification. Finalize code, tests and tracked
documentation before the final run; record final identities and report paths
in an external handoff. Then run:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands and current cumulative native evidence, including
new join/picking checks, on the same tracked/untracked/binary identity. Any
checkout change after verification requires matching verification again.
Obtain independent read-only review of that verified tree against
`prompts/phase-32b-review.md`, explicitly reassessing both join failures and
concave-corner behavior using independent SVG paint evidence. `32B verify`
itself does not perform review.

Do not commit or push while the finding or either gate remains unsuccessful.
32B stays incomplete until the defect, verification and review are resolved;
32C/32D remain deferred.
