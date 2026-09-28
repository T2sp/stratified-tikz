# Phase 32B Targeted Fix Prompt: Resolve remaining native dash endpoint mismatches

## Environment and scope

Work on `phase/32b-color-opacity-outline`. Read `AGENTS.md`, the paired 32B
implement/review prompts, current implementation report and
`docs/PHASE_32B_ZERO_DASH_INVESTIGATION.md`. Preserve the 17 existing changed
files and all completed zero-dot, solid-join, effective-style and diagnostic
work. At this prompt update there are no untracked files; the earlier 150 dash
and four visibility files are tracked. Do not reset or restart existing work.

Starting HEAD is `0cf597f1a71b249e73374b354d69409ba4c51979`. The latest handoff
and parent verification match this pre-prompt tracked/untracked/binary identity:

```text
b4a31d7b7a4a0b99937396a987a9c833f7d973fbdcb61e531ab142934fc3995c
```

Recompute final identity after corrections; this is not verification of later
edits. Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Resolve the retained terminal-seam false candidates, positive-endpoint and
zero-off omissions, and disproven positive/negative witnesses using the complete
native evidence. Investigate the specific raster/containment disagreements
before changing their oracle contract. Preserve successful isolated zero-dot
corrections and native visibility progress. Keep strict TypeScript, existing
dependencies and 32A/32B contracts; keep 32C/32D deferred.

## Latest evidence and acceptance status

Read and preserve:

```text
/private/tmp/stz-phase32b-zero-dash-followup/HANDOFF.md
/private/tmp/stz-phase32b-zero-dash-followup/independent-review.md
/private/tmp/stz-phase32b-zero-dash-followup/independent-positive-corner.json
/private/tmp/stz-phase32b-zero-dash-followup/evidence/INSPECTION.md
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-qwpJ7Z/response.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-epviae/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-epviae/05-check-free-labels/command.log
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-epviae/05-check-free-labels/artifacts/free-labels-evidence.json
```

The zero-dash followup implemented full isolated square/disk dots, corrected the
zero-on exterior witness, preserved original evidence and expanded native
coverage. Its child verification passed 4,286 tests/build/diff and strict checks;
both browser attempts stopped at localhost `EPERM`. Independent review returned
`needs_changes` for the positive-corner contract/geometry conflict and missing
native acceptance. That review predates the new parent observations.

The subsequent parent `epviae` run reached Chrome **154.0.8037.57** on Node
**v26.9.0**, with matching before/after checkout fingerprints:

| Required command | Parent result |
| --- | --- |
| `npm test` | 4,286 passed, zero failed/skipped/cancelled |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| `npm run check:label-assets` | Passed |
| `npm run check:free-labels` | Failed during `point-paint-dash-caps` |

The cumulative report has 14/16 completed groups, no page errors, an incomplete
paint/import group and an unexecuted final `settled-SVG-export-standalone` group.
The harness retained **all 18 App entries (14 passed, four failed)** and
**all 19 supplemental mechanism entries (15 passed, four failed)**. It preserves
the first error while continuing the matrix; the terminal stack is not an
inventory of all remaining defects. Do not describe later entries as unexecuted
or count the overall dash scenario as passed.

The previously failing `square-exact-zero` now passes at both `.5` and `1.5`
scales, with zero grid mismatches and actual ordinary/Alt actions. Its layout
radius is `32.526911934581186` against raster radius `32.482717760757026`.
Both internal-zero App variants also pass at both scales. Literal raw/exact,
reverse-winding, diagonal zero-dot and near-zero-corner/seam controls passed.
Preserve these new successes without claiming complete native acceptance.

## 1. First failure: terminal-seam false candidates

Use the actual command log and serialized evidence, not the pasted diff's
ambiguous formatting. The first failure is **`square-terminal-zero`, scale
`0.5`**, the eleventh App entry, at the `audit-outside` ordinary pointer action:

```text
actual candidates:   ['control', 'p']
expected candidates: ['control']
```

Read `point-paint-dash-caps.json` and the following artifact stems under the
`epviae` artifacts root, for both scales:

```text
point-paint-dash-caps-square-terminal-zero-scale-0.5
point-paint-dash-caps-square-terminal-zero-scale-1.5
```

Inspect each `.json`, `.input.svg`, `.raster.png`, `.screen.png`,
`-solid.input.svg`, `-solid.raster.png`, `-engine-audit.json` and retained pointer
screenshots. Keep failure metadata and actual action records intact.

This case uses empty source, square size `5.892556509887896`, disabled fill,
width `30pt` (36 local units), explicit pattern `[0,15/1.2]`, phase `5/1.2`,
square caps and bevel joins. Emitted native pattern is `0 15`, offset `5`,
miter limit 10. At local **`(22,-18)`**:

- Raster alpha is 0 and live native stroke containment is false.
- Paint distance is `6.447049955212074`; continuous solid-stroke distance is
  `8.485396462452417`. Both exceed the six-unit tolerance plus `.14` uncertainty.
- A trusted ordinary click records `['control','p']` although only `control`
  should be a candidate. Its selected `control` does not hide the extra `p`.

Each scale's full 1,089-cell audit contains **45 false-hit candidates** and no
missed hits. Radius/bounds enclosure passes, but rectangular layout bounds
extend to maxX 23 while the retained paint reaches only maxX 18. Do not solve
this with another radius-only change or treat a passing enclosure as exact
stroke geometry.

The current terminal `exact` witnesses `(21,-21)` and `(22,-22)` are also
incorrectly required to be painted positives. They have alpha 0/native exclusion
and paint distances about `8.0313107974` and `9.0313040656`; production still
includes `p`. Retain these as explicit demonstrated negative regressions after
checking both paint and continuous-stroke distances. Keep independently painted
terminal-case positives, such as the retained `(-22,-22)`, with native clicks.
Do not silently remove the disconfirming witnesses.

## 2. Positive corners: invalid exterior and separate missing candidates

Inspect both `point-paint-dash-caps-square-positive-corner-scale-*` entries and
all associated source/raster/grid/pointer records. This case has the same raw
square/width/cap/join but explicit local pattern `[10,10]`, phase zero.

At `(20,20)`, the contract says `outside`, but native alpha is 255 and stroke
containment is true. The trusted click correctly includes and selects `p`.
Fresh native evidence now resolves that witness conflict: retain `(20,20)` as
a painted positive and replace its erroneous exterior role with an independently
verified nearby miss beyond both paint and intentional continuous-stroke
regions. The retained `(-22,-30)` has alpha 0/native exclusion, paint distance
`7.0313194441` and solid distance `16.9706202929`; verify it in the corrected
case at both scales. Keep the positive and genuine negative, not just a renamed
or deleted assertion.

Changing that witness alone is insufficient. Each scale's complete grid records
**76 expected-hit omissions** and no false hits. For example, `(16,-22)` and
`(22,-22)` are fully painted/native-contained but absent from production
candidates. Correct the positive endpoint geometry as well as the test witness.
Retain actual ordinary/Alt evidence that these points become reachable, with an
overlapping control unable to mask missing `p` candidates.

## 3. Resolve all supplemental mechanisms and oracle disagreements

Read the full `point-paint-dash-cap-mechanism.json` and every per-case `.json`,
input SVG, raster and solid control, especially these four failed stems:

```text
point-paint-dash-cap-mechanism-zero-terminal-seam
point-paint-dash-cap-mechanism-zero-off-continuous
point-paint-dash-cap-mechanism-positive-exact-corner
point-paint-dash-cap-mechanism-positive-before-corner
```

All use independently specified literal square vertices, width 36, square caps
and bevel joins. Retained grid discrepancies are:

| Mechanism | Pattern / phase, local units | Discrepancy against independent paint/continuous-stroke oracle |
| --- | --- | --- |
| `zero-terminal-seam` | `[0,15]` / `5` | 45 false hits; first reported assertion is zero-on paint distance at `(16,-32)` |
| `zero-off-continuous` | `[10,0]` / `0` | 208 missed hits |
| `positive-exact-corner` | `[10,10]` / `0` | 76 missed hits |
| `positive-before-corner` | `[10,10]` / `.25` | 39 missed hits |

The supplemental rows compare geometry distances to independent SVG observations;
they are not App pointer events. Use them alongside, not instead of, actual
candidate/click evidence. The `zero-off-continuous` name/current early-return
comment does not prove native caps disappear for zero-length gaps. At
`(-22,-22)`, this case has both opaque paint and native containment, but geometry
distance about `11.3137` and no hit. Preserve that independently corroborated
miss while investigating zero-off scheduling/coalescence.

There is also a specific oracle disagreement. `zero-off-continuous` has 24
opaque raster-core cells with native `isPointInStroke` false;
`positive-before-corner` has 30. At `(16,-22)` in the latter, raster alpha is
255 with distance zero, but native containment is false and geometry distance
about `7.0711`. The current core-implies-native-containment contract would fail
there even after repairing candidate omissions. `positive-exact-corner` and
both App positive-corner audits do not have that core/containment disagreement.

Investigate cloned SVG rasterization versus live SVG containment, exact source,
computed settings, parsed path, coordinate transforms/resolution and actual live
rendered paint. Preserve both contradictory observations. Distinguish an oracle
or engine limitation from a production geometry error using independent live
paint and native action evidence. Do not silently discard containment or raster
checks, redefine opaque cores, or assume source-level Skia/Cairo behavior proves
this Chrome result. If an oracle assertion itself is disproven, document the
mechanism and replace it with independently justified checks/negative controls
that retain detection strength; keep the disagreement visible in evidence.

## 4. Targeted correction and regression requirements

Inspect `src/geometry/dashCaps.ts`, `polygonStroke.ts`, point layout/view/stroke/
paint/hit testing, `scripts/checkPointDashCaps.mjs`, `pointDashCapContract.mjs`,
`checkPointDashCapMechanism.mjs`, `pointDashCapMechanismContract.mjs`, their
registered tests and synthetic fixtures. Trace positive endpoint orientation,
terminal-only seam inclusion, zero-off coalescence and exact/near-corner ownership.
Use the retained native controls to determine which rules need correction.

Preserve full source precision and saved patterns. The prior raw zero-square
edge lengths are `10,10,10.000000000000002,10.000000000000002`, with cumulative
endpoints exactly `10,20,30,40`; the repaired defect was full-dot extent, not a
proven rounding error. Do not perturb coordinates/patterns or apply a broad
comparison epsilon to evade the new reproductions. Keep supported short intervals,
large/wrapped phases and bounded arithmetic families without iteration proportional
to dash count, pattern clamping or normalization that removes valid zero entries.

Correct shared cap geometry so bounds, radius, pending/committed selection and
immutable exports remain consistent. Keep six local units of picking tolerance,
the separate six-unit selection decoration allowance and `.14` raster uncertainty.
Retain original contour interiors and continuous-stroke selection through gaps.
Do not replace precise geometry with a bounding box, inflate tolerances, or force
selection to make candidate assertions pass. Preserve butt/round/solid controls,
solid bevel/miter exterior misses and genuine outward-tip/dashed-cap hits.

Register regressions for each demonstrated mechanism and every witness/oracle
correction. Cover exact and near endpoints, seam sides, zero-on versus zero-off,
positive dash intervals, relevant winding/diagonal controls, both responsive
scales and live style changes. Include new actual-App pointer witnesses for
supplemental defects where needed. Preserve raw SVG/model/effective settings,
parsed geometry, path length, browser identity, transforms and raster calibration.
Use independent observations and analytic constructions, not production helpers
as their own oracle. Keep original failed files byte-identical and write corrected
results separately. Update synthetic fixtures/policy consistently and label them
as synthetic, never native acceptance.

Retain all matrix entries and every complete grid. Keep per-entry status,
continuation after individual failure, bounded failure captures and primary-error
retention; continue through both matrices before reporting the first failure.
A failed/incomplete matrix must not produce a passed scenario. Require at least
**18 App entries, ten complete 1,089-cell square audits and 19 supplemental
mechanism entries with their complete grids**. Preserve trusted ordinary/Alt
clicks, cleared selection, overlay exclusion, actual transforms and candidate
inspection as well as final selection. Add coverage rather than replacing
failed cases with easier ones.

The current cumulative minimum is **16 groups, 29 point scenarios and 705
required artifacts**: original 386 + original 219 dash artifacts + four zero-dot
witness screenshots + 96 mechanism artifacts. Preserve these and extend required
coverage for added witnesses. Update policy/negative controls explicitly without
reducing coverage or accepting stale/malformed/missing evidence. Keep fresh-process
policy loading, file-backed fixture memory behavior, runner deadlines and failed
artifact retention. No retry-until-green, global concurrency change or deadline
inflation.

## Preserve completed work and verification history

Keep the isolated full square/disk dot correction, zero-on positive witnesses
`(-22,-22)`/`(20,20)` and genuine negative `(-22,-30)`, effective style defaults/
pattern precedence, content-based layout matching, phase handling, existing
256-edge square-cap circle contour and solid-join fixes. Preserve the successfully
observed diagonal and internal-zero controls. Original Cairo fixtures, source
inspection and analytic tests keep their distinct scope; new native evidence
does not retroactively change their bytes or establish a universal engine rule.

Keep native visibility diagnostics, trusted input/change witnesses, deliberately
different pre-reload UI settings, both 2D/3D and inline/standalone restoration,
full payload/history/selection/revision assertions and immutable downloads.
Preserve the corrected monitor-drain race, bounded actual-App snapshots,
late-rejection ownership and owned-resource cleanup. Historical `UThawr`'s
visibility timeout cause remains unproven; subsequent passes are progress, not
proof of that old mechanism. Do not reopen control/CSS behavior without evidence.

Preserve importer uncertainty/local overrides and independent PGF evidence;
independent paint/opacity/dimming; legacy normalization, clipboard/cloning/history;
raw JSON/CRLF, 2D/3D/work-plane semantics, free/inline labels and whole-node exports.
Keep five geometry fault controls, seven App → SVG → App transitions, three
continuity controls/13 artifacts, directory scenario/11 artifacts and six
responsive downloads/91 artifacts. Keep lifecycle instrumentation/deterministic
timeout tests, the runner's 60-second fixture deadline and original failure/rerun
history. No unrelated cleanup, new dependencies or 32C/32D work.

The followup handoff is authoritative for its frozen identity. The older
`/private/tmp/stz-phase32b-zero-dash-handoff/` is a different checkout and its
unfinished `vaZYVU` report is not a pass. Earlier `YAt03b` and child `EPERM`
records remain separate; the new parent run demonstrates real native progress
and failures rather than a current startup blockage.

## Final verification and independent review

Document the actual mechanism, geometry/witness/oracle corrections, retained
failures and remaining uncertainty. Run focused registered regressions,
applicable strict production/fixture/test TypeScript, changed-script syntax,
targeted lint and diff checks. Separate documented baseline lint debt and the
existing bundle warning from new failures; do not report excluded guarded
cleanup findings as a completely clean repository-wide lint run.
Run `npm test` and `npm run build` sequentially because they share asset preparation.

Finalize code/tests/tracked docs, then record final identity/report paths in an
external handoff. In the authorized browser-capable parent, run:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands on the same final tracked/untracked/binary identity,
both complete native reports, all required matrices/scenarios/artifacts, no page
errors and no incomplete/unexecuted groups. Include the final settled SVG group
that `epviae` did not reach. Partial matrix passes and child startup restrictions
do not satisfy acceptance. If execution is blocked, preserve the exact limitation
and hand off for authorized parent execution without bypassing approval or
changing permissions.

Any checkout edit after verification requires matching verification again.
Obtain fresh independent read-only review against `prompts/phase-32b-review.md`,
including all four supplemental failures, both App failure families, corrected
witnesses/oracles and preserved completed behavior. `32B verify` does not itself
perform review. Do not commit or push while required verification/review is
unsuccessful. 32B remains incomplete until all gates pass; 32C/32D remain deferred.
