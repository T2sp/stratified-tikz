# Phase 32B Targeted Fix Prompt: Match zero-length dash caps to native paint

## Environment and scope

Work on `phase/32b-color-opacity-outline`. Read `AGENTS.md`, the paired 32B
implement/review prompts, current implementation report and relevant geometry/
diagnostic documentation. Preserve all existing tracked changes and four
untracked visibility investigation/helper/test files. The 150 formerly untracked
dash files are now tracked; preserve that completed work as well.
At this prompt update HEAD is `5c1ef003fe14b6cbc8f857214ec28e66541dfaea`.
The visibility handoff and latest parent report match this pre-prompt identity:

```text
ac28529b414946a27ff5b706976fbacaaecfdf94e3ab2ff8b08d53231c11e67b
```

Recompute final tracked/untracked/binary identity after corrections; this hash
is not verification of subsequent edits. Do not reset or restart existing work.
Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Correct the demonstrated disagreement between native zero-length square-cap
paint and point selection geometry/picking. Correct the independently disproven
exterior test witness without weakening acceptance. Preserve effective-style
layout matching, solid joins, bounded dash work and completed visibility
diagnostics. Keep strict TypeScript, existing dependencies and 32A/32B behavior;
keep 32C/32D deferred.

## Latest evidence and acceptance status

Read and preserve:

```text
/private/tmp/stz-phase32b-visibility-handoff/HANDOFF.md
/private/tmp/stz-phase32b-visibility-handoff/independent-review.md
/private/tmp/stz-phase32b-dash-handoff/HANDOFF.md
/private/tmp/stz-phase32b-dash-handoff/independent-audit-index.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-epfGdz/response.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-YAt03b/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-YAt03b/05-check-free-labels/command.log
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-YAt03b/05-check-free-labels/artifacts/free-labels-evidence.json
```

The visibility implementation's final child verification passed 4,225 tests,
build/diff, strict TypeScript and targeted lint. Its browser attempts stopped
at localhost `listen EPERM`; independent review remained `needs_changes` for
unresolved historical visibility behavior and unavailable native acceptance.
Its added diagnostic monitor race was corrected separately; that fix does not
explain the historical Chrome checkbox timeout.

The subsequent parent `YAt03b` report has matching before/after identity and
actual Chrome **154.0.8037.57** on Node **v26.9.0**:

| Required command | Parent result |
| --- | --- |
| `npm test` | 4,225 passed, zero failed/skipped/cancelled |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| `npm run check:label-assets` | Passed |
| `npm run check:free-labels` | Failed during `point-paint-dash-caps` |

The cumulative report records **14/16 completed groups and 28/29 passed point
scenarios**, with no page errors. The paint/import group is incomplete and
`settled-SVG-export-standalone` remains unexecuted. New native point persistence,
App workflows, continuity, responsive downloads and polygon joins passed before
the dash failure. This is a runtime assertion with retained native paint/candidate
evidence, not another server-startup restriction or checkbox timeout.

The original `UThawr` visibility timeout remains historically unexplained.
However, `YAt03b` now supplies both 3D modes' trusted checkbox transitions and
complete reloads, including the previously missing standalone path. Preserve
this progress without calling the original mechanism proven fixed. Earlier
`wPPGzN` acceptance and child `EPERM` runs retain their own scope and identity.

## 1. Reproduce the exact zero-length dash failure

The first assertion fails at `scripts/pointDashCapContract.mjs:30`, called by
`runPointDashCapChecks` at `scripts/checkPointDashCaps.mjs:204`:

```js
assert.ok(Number.isFinite(observation.selectionRadius)
  && observation.selectionRadius + .14 >= observation.rasterRadius)
```

The failing entry is **`square-exact-zero`, scale `0.5`**, ninth in the 18-entry
case/scale sequence. Read these retained files under the `YAt03b` artifacts root:

```text
point-paint-dash-caps-square-exact-zero-scale-0.5.json
point-paint-dash-caps-square-exact-zero-scale-0.5.input.svg
point-paint-dash-caps-square-exact-zero-scale-0.5.raster.png
point-paint-dash-caps-square-exact-zero-scale-0.5.screen.png
point-paint-dash-caps-square-exact-zero-scale-0.5-solid.input.svg
point-paint-dash-caps-square-exact-zero-scale-0.5-solid.raster.png
point-paint-dash-caps-square-exact-zero-scale-0.5-engine-audit.json
```

The model uses empty source, square size `5.892556509887896`, disabled fill,
enabled black border of `30pt`, `lineStyle: 'solid'` with explicit pattern
`[0, 10 / 1.2]`, phase zero, `lineCap: 'rect'` and `lineJoin: 'bevel'`.
Explicit pattern precedence yields native width `36`, dash array `0 10`, square
caps, bevel joins and miter limit 10. The source is ready. Raster observation
uses 16 pixels per local unit. Native CTM is scale `.5` with translation
`(225,175)`; all probe coordinates below are local.

| Retained observation | Value |
| --- | --- |
| Reported selection radius | `26.419689627245816` |
| Raster radius | `32.482717760757026` |
| Radius deficit | `6.06302813351121`, well beyond `.14` raster uncertainty |
| Declared painted bounds | Approximately `[-23,-23,23,23]` |
| Raster bounds | `[-23,-23,23,23]`; bounds enclosure already passes |
| Complete grid | 1,089 samples: 829 expected hits, 252 misses, 8 uncertain |
| Candidate mismatches | 96 expected-hit samples with empty candidates |

The observer reads selection-circle `r` minus its existing six-unit decoration
allowance. Keep that allowance distinct from the `.14` raster uncertainty and
the six-local-unit picking tolerance. Do not simply add one to another.

This is not only a radius assertion. The independent audit records:

- `(-22,-22)`: alpha 255, paint core, native `isPointInStroke` true, outside the
  original contour, solid-stroke distance about `11.3137948154`; candidates `[]`.
- `(20,20)`: alpha 255, paint core, native stroke containment true, solid-stroke
  distance about `8.48539646245`; candidates `[]`.
- `(-22,-30)`: alpha 0, native stroke containment false, paint distance about
  `7.03131944410` and solid distance `16.9706202929`; an independently observed
  exterior negative beyond the unchanged tolerance.

The failing entry has `probes: []`: its raster/grid observations were saved,
but ordinary/Alt pointer actions had not run when the radius assertion stopped
execution. Do not claim those native clicks passed or failed. Earlier triangle,
circle and star entries reached their pointer checks at both scales; later
square entries, including this case at scale `1.5`, remain unexecuted.

## 2. Correct geometry and the invalid exterior witness using native evidence

Inspect `src/geometry/dashCaps.ts`, `polygonStroke.ts`,
`src/rendering/svgPointNodeLayout.ts`, `svgPointStroke.ts`, `svgPointNodeView.ts`,
`svgPointPaint.ts`, `svgHitTesting.ts`, and the dash contract/observer/fixtures.
Trace effective settings and emitted geometry through painted bounds, radius,
selection candidates and exports. Correct shared geometry rather than padding
only selection decoration, replacing picking with a box/radius, or suppressing
the failing contract.

Investigate zero-length on intervals at polygon vertices and closed-path seams,
including endpoint orientation and cap extent. Retain full emitted precision:

```text
5.000000000000001,-5 -5,-5.000000000000001 -5.000000000000002,5 5,5.000000000000002
```

The native audit's parsed `contour.points` instead reports exact `(5,-5)`,
`(-5,-5)`, `(-5,5)`, `(5,5)`. Current cap scheduling uses exact endpoint comparisons
and incoming/outgoing tangent rules. Compare raw source coordinates, native
parsed/path geometry and endpoint arithmetic before attributing the mechanism.
Use independent exact and near-corner/seam observations to distinguish numerical
representation from cap semantics. The retained assertion alone does not prove
which rule is wrong. Do not perturb the shape/pattern to avoid the reproduction
or introduce a broad epsilon that erases legitimate short intervals.

Retained Cairo results and Chrome results must remain separately identified.
The earlier Cairo internal-zero normalization in 28 matrix cases is not a
universal SVG rule. Do not force native expectations to match old helper/Cairo
assumptions, or normalize supported zero entries away. Require agreement between
the application's emitted native paint and its geometry, preserving raw model
intent and export behavior. Keep independent observations as the oracle.

The current case specification incorrectly calls `(20,20)` `exterior`.
Native alpha and containment now disprove that classification. Retain `(20,20)`
as an explicit painted-positive regression; provide a genuinely exterior
negative established by independent raster distance and native containment,
such as the retained `(-22,-30)` witness after checking both scales. Preserve
a nearby miss beyond both painted and intentional continuous-stroke regions.
Update the case contract, synthetic policy fixtures and registered tests
consistently. This changes a disproven witness, not the acceptance strength:
no deleting exterior controls, recategorizing true paint as background, reducing
sample coverage, or moving all negatives arbitrarily far away.

Fix candidate omissions as well as radius enclosure. Keep original contour
interiors and the continuous stroke neighborhood selectable through dash gaps;
include real cap extensions with exactly six local units of tolerance. Preserve
solid bevel `(0,-24)` and solid miter `(0,28)` misses, genuine miter-tip hits and
the dashed triangle `(0,-24)`/`(-6,-28)` hits. Do not add synthetic inward wedges,
restore rounded polygon expansion, inflate `.14`, increase picking tolerance,
or merely substitute the bounding-box diagonal as the hit oracle.

## 3. Registered regressions and fresh native acceptance

Add focused registered regressions for the demonstrated geometry mechanism and
for the invalid witness correction. Require the exact raw-source reproduction,
fully painted missed samples, meaningful exterior negatives and consistent
radius/bounds/candidate behavior. Cover exact/near vertices, seams and winding
where relevant, zero-on/zero-off/mixed patterns, positive dash endpoints,
phase changes and wide overlapping caps. Preserve butt/round and solid controls,
circle representation, interior/gap policy and disabled/transparent behavior.
Do not derive all expected results from the implementation under test.

Retain original failed SVG/raster/audit bytes separately from corrected evidence.
Save model/effective styles, raw emitted SVG, parsed geometry, browser identity,
transforms, raster resolution and uncertainty so numeric claims are reviewable.
Keep all 1,089 grid cells and independently determined hit/miss outcomes;
correct all demonstrated candidate mismatches without hiding new false hits.
Register tests in the explicit `package.json` list. Preserve synthetic fixture
labels: synthetic policy validation is not native acceptance.

Run the full native matrix after correction, not just until the first radius
passes. Require all **18 case/scale entries**, including previously unexecuted
terminal/positive-corner/internal-zero variants at both `.5` and `1.5` scales,
and every required complete square audit. Obtain trusted ordinary clicks and
Alt cycling at painted positives and genuine exterior negatives with cleared
selection, overlay/handle exclusion, actual transforms and overlap-control
candidates. Preserve live style edits and stale/refreshed layout checks. An
unpassed or aborted case must not be recorded as a successful scenario.

Keep at least **16 cumulative groups, 29 point scenarios and 605 artifacts**,
including the original 386 and 219 dash artifacts. Add required evidence for new
probes as needed; update policy and negative controls without lowering existing
coverage or accepting mismatched identities. Keep no-op/omitted/malformed
artifact rejection, fresh-process policy loading and file-backed fixture memory
behavior. Do not restore retained multi-megabyte JSON closure copies.

## Preserve visibility progress and completed work

Inspect `YAt03b`'s `point-native-controls-index.json`,
`point-native-app-lifecycle.json` and
`point-native-direct-cursor-workplanes-inspector-persistence.json`.
Both 3D modes now record trusted sorting `false -> true` and visibility
`true -> false` actions on the same document/control identities, then full
saved UI/control restoration to sorting false, visibility true and theta 41.
Inline reload advances revision `4 -> 5`; standalone advances `5 -> 6`.
Both 2D iterations also pass. Full payload comparisons, selection/redo clearing
and immutable downloads remain intact. The native controls index retains 76
available captures without diagnostic errors or dropped samples/events.

Preserve bounded actual-App diagnostics, control/event witnesses, differing
pre-reload settings and complete restoration assertions. Keep mandatory captures
outside the optional monitor's action/drain interval: the fixed diagnostic race
is separate from the original scrolling timeout. Retain the original error/log/
stack, finite capture/write/screenshot bounds, late-rejection ownership and
listener/resource cleanup. Preserve `check:point-native-focused` as diagnostic
only, never a substitute for cumulative acceptance. Do not reopen checkbox/CSS
or interaction behavior without new evidence. If the old timeout recurs, inspect
the existing bounded observations and retain the unproven cause explicitly;
one passing run does not establish its historical mechanism.

Preserve shared effective stroke defaults, pattern precedence, phase handling,
bounded scheduling for extreme valid inputs, content-based committed-layout
matching and pending/committed/export consistency. Keep the existing 256-edge
contour for active square-capped dashed circles, all solid-join fixtures and
independent positive/exterior controls except the specifically disproven witness.
Preserve importer uncertainty/local override intent and independent PGF evidence;
paint/opacity/dimming; legacy normalization, cloning/clipboard/history; raw
JSON/CRLF; 2D/3D/work-plane semantics; free/inline labels and immutable exports.

Keep five native geometry fault controls, seven App → SVG → App transitions,
three continuity controls/13 artifacts, directory scenario/11 artifacts and six
responsive downloads/91 artifacts. Retain lifecycle timeout instrumentation and
deterministic tests, real I/O evidence, original failure/rerun distinctions,
runner diagnostics, 60-second fixture deadline, owned-process cleanup and failed
evidence retention. Do not change global concurrency/deadlines or retry until
green. No unrelated cleanup, new dependencies or 32C/32D work.

## Verification and independent review

Document the observed mechanism, correction, invalid-witness change, independent
results and remaining uncertainty. Run focused registered regressions, applicable
strict production/fixture/test TypeScript, changed-script syntax, targeted lint
and diff checks. Keep demonstrated baseline lint debt and existing bundle-size
warning separate. Run `npm test` and `npm run build` sequentially because they
share asset preparation.

Finalize code/tests/tracked docs, and record final identity/report paths in an
external handoff. In the authorized browser-capable parent, run:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands on the same final tracked/untracked/binary identity.
Inspect both browser reports, complete scenarios/artifacts, terminal success,
no page errors and no incomplete/unexecuted groups, including the final settled
SVG group that `YAt03b` did not reach. The partial parent result does not satisfy
this gate, and child startup restrictions are not passing native checks.
If execution is blocked, retain the exact limitation and hand off for authorized
parent execution without changing permissions or bypassing approval rejection.

Any checkout edit after verification requires matching verification again.
Obtain fresh independent read-only review against `prompts/phase-32b-review.md`,
covering zero-length native geometry/picking, corrected positive/negative
witnesses, full engine audits and retained visibility/persistence evidence.
`32B verify` itself does not perform review. Do not commit or push while required
verification/review is unsuccessful. 32B remains incomplete until all gates
pass; 32C/32D remain deferred.
