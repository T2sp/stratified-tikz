# Phase 32B Targeted Fix Prompt: Correct the paint oracle and bound acceptance

## Scope and proposed completion boundary

Work on `phase/32b-color-opacity-outline`. Read `AGENTS.md`, the paired 32B
implement/review prompts, the current implementation report, and
`docs/PHASE_32B_NATIVE_ENDPOINT_INVESTIGATION.md`.

The user has requested consideration of less demanding verification because
32B has repeatedly expanded without reaching completion. Recommend a finite
core acceptance profile: preserve normal editing, data, imports and outputs;
separate exhaustive dash-seam/rendering-engine conformance from those gates.
Do not continue adding mandatory matrices merely because another engine edge
case can be constructed.

**This is a proposed scope amendment, not an adopted waiver.** The current
prompt update changes no implementation or verification policy. Unless the
user subsequently accepts the proposal, retain the current strict gate and
report its failures honestly. Prepare an itemized required/advisory inventory
and a concrete scope decision; independently justified oracle corrections and
bounded investigation can proceed without assuming approval to waive defects.
Do not automatically call the current checkout complete.

Preserve the 20 already modified tracked files and 31 untracked files (the
native endpoint investigation and 30 fixture/manifest files). Starting HEAD is
`beae63a78adb1e65608f6cce7b71da66e3cf5033`. The latest handoff and parent run match
this pre-prompt tracked/untracked/binary fingerprint:

```text
2054380c655ef083aa18be381508ece020cef5484b80b004d0b214b144aef9d7
```

Recompute identity after changes. Do not reset existing work. Keep strict
TypeScript, existing dependencies and completed 31F/32A behavior. Keep 32C/32D
deferred. Use Node >=22.12.0 with `/opt/homebrew/bin` first in PATH.

## Latest evidence: actual native progress, still a failed strict run

Read and preserve:

```text
/private/tmp/stz-phase32b-endpoint-followup/HANDOFF.md
/private/tmp/stz-phase32b-endpoint-followup/independent-review.md
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-iQIRUd/response.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-pF6DA7/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-pF6DA7/05-check-free-labels/command.log
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-pF6DA7/05-check-free-labels/artifacts/free-labels-evidence.json
```

The followup corrected terminal-only zero dots, outgoing orientation at positive
dash starts and zero-off interval scheduling. Its final 4,366 tests, build,
diff and strict checks passed. Child browser startup was blocked by `EPERM`,
and Chrome UI access was denied. Its independent `needs_changes` review predates
the following real parent browser observations; do not describe the parent run
as another startup failure.

The matching `pF6DA7` parent run used Node v26.9.0 and Chrome 154.0.8037.57:

| Command | Result |
| --- | --- |
| `npm test` | 4,366 passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| `npm run check:label-assets` | Passed |
| `npm run check:free-labels` | Failed during `point-paint-dash-caps` |

The report has 14/16 completed groups, no page errors, an incomplete paint/import
group and an unexecuted final `settled-SVG-export-standalone` group. All **22 App
entries were attempted: 18 passed, four failed**. All **21 supplemental mechanism
entries were attempted: 18 passed, three failed**. Preserve the complete matrices;
the terminal stack is not the full failure inventory.

The first failure is `square-zero-off`, scale `.5`, at the `audit-cap` ordinary
click, local `(22,-22)`, in `pointerProbe` / `checkPointDashCaps.mjs:237`:

```text
actual candidates:   ['control']
expected candidates: ['control', 'p']
```

Both responsive scales (`.5`, `1.5`) fail for `square-zero-off` and
`square-positive-before-corner`. The latter's failed paint witness is
`(22.90625,-22.90625)`. Supplemental failures are `zero-off-continuous`,
`positive-before-corner`, and **`positive-full-closed-control`**. The third is
new relative to the child summary and must not be omitted.

The earlier terminal, exact-positive, isolated-zero, internal-zero, circle,
star and triangle entries now pass. Preserve that progress. Current strict
policy requires 16 groups, 29 point scenarios and 856 artifacts, including
14 complete square audits and 21 supplemental mechanisms. These are the
current policy facts, not a target that must keep growing.

## 1. Correct the editor interaction oracle using connected live paint

Inspect `point-paint-dash-caps.json`, `point-paint-dash-cap-mechanism.json`,
per-case source/raster/solid controls, engine audits, connected live screenshots,
responsive and magnified App screenshots, and actual ordinary/Alt action records
under the latest parent artifacts root.

The two square families disagree across observation paths:

- Cloned SVG rasterization marks disputed seam points as opaque paint.
- Actual connected App screenshots show background at the disputed points,
  at both responsive scales and magnification 16; live containment excludes them.
- The 24 zero-off and 30 before-corner opaque-clone/core contradictions are
  background in retained magnified live paint. Connected literal SVG screenshots
  at scales 1 and 16 corroborate this distinction.

A read-only offline recalibration against retained scale-16 live PNG paint,
using the unchanged six-unit tolerance, `.14` uncertainty and continuous-stroke
control, found **zero definite grid mismatches** for `zero-off-continuous` and
`positive-before-corner`. This is evidence for an inappropriate interaction
oracle, not a fresh passing native run or proof of every workflow. Reproduce
and retain the independent pixel-distance calculation before changing assertions.
Do not describe the original 24/39 clone-based grid discrepancies as established
unclickable visible App paint.

For editor interaction, use independently observed connected live paint in the
same DOM/state as the action. Bind PNG/source hashes, dimensions, computed style,
CTM, viewport/scale and positive/background calibration. Preserve the six-unit
picking tolerance, separate selection decoration allowance, contour interiors
and intentional continuous-stroke selection through dash gaps. A background
pixel can still be a required hit within those regions; background alone does
not establish a negative witness.

Keep clone-raster, live containment, live pixels and production geometry as
separate observations. Neither `isPointInStroke` nor production distance helpers
alone may define expected interaction. Retain independent positive and exterior
controls and trusted ordinary/Alt events with complete candidates; an overlapping
control must not mask a missing or extra `p`. Correct the disproven expectations
with explained replacements, not forced selection or larger tolerances.

Keep clone/render-surface disagreement visible as a diagnostic. Actual downloaded
SVG paint and reopening still require their own checks; a corrected App oracle
does not automatically certify export appearance or excuse export data loss.

## 2. Bound the remaining real closed-path discrepancy

The supplemental `positive-full-closed-control` uses literal triangle vertices
`0,0 24,0 12,16`, width 12, square caps, bevel joins, pattern `[100,100]`, phase 1.
This long positive interval covers the closed path. Offline live-paint evaluation
still finds **24 definite omissions**. At `(0,-14)`, live paint is approximately
5.7732 local units away but production distance is 8, outside the six-unit
picking tolerance. This is a real discrepancy against visible paint, even
though the queried pixel itself is background.

That exact arbitrary triangle is not an existing point-shape contour. Its impact
on supported regular point shapes has not been demonstrated. Perform one bounded
transfer check on supported point shapes with the same uninterrupted closed-dash
mechanism, including a genuine exterior control. Determine whether the discrepancy
is reachable through current editing/export workflows. Report the result; do not
claim ordinary workflows unaffected without evidence or launch another general
sweep of arbitrary polygons and engines.

Recommended disposition if the core profile is accepted: retain this exact
supplemental discrepancy as a named followup limitation when no current supported
workflow defect is demonstrated. Record trigger, impact, evidence and the precise
scope of deferral. Do not label it fixed, silently drop its row, or claim a
workaround without checking it. A demonstrated normal-workflow miss still needs
a narrow fix or a further explicit scope decision; the proposal is not a blanket
waiver of picking failures.

Do not restore the rejected generic initial/terminal seam cap. It falsely
expanded the retained triangle dash-phase radius from about 28.42645 to 30.4021
(native raster about 28.39994), creating phantom hits at `(-6,-34)` and `(0,-32)`.
Preserve both negative controls and the corroborated terminal/positive fixes.

## 3. Proposed finite core acceptance profile

Prepare the following amendment for consideration. Keep all five verification
commands and all cumulative Phase 31F/32A groups plus the 32B paint/import group.
Keep the 29 scenario identities, with the dash scenario's required observations
specified explicitly rather than equating success with every supplemental grid.

| Remains mandatory | Proposed separate diagnostic / followup |
| --- | --- |
| Native text/fill/stroke color and opacity, disabled paint, dimming, border width/style, explicitly colored math | Exhaustive cross-rendering-path pixel equivalence at every dash seam |
| Legacy/new documents and presets, cloning, clipboard, bulk edit, Undo/Redo, raw text and exact serialization | Additional arbitrary-polygon/engine research beyond supported 32B workflows |
| Bounded imported-style resolution, runtime uncertainty, untouched external semantics, explicit local overrides, both TikZ modes and independent PGF references | Precisely named supplemental full-closed-path limitation, subject to the supported-shape transfer check above |
| Normal selection, drag, overlap cycling, 2D/3D/work planes, responsive layout, independently corroborated solid-join and dash-cap regressions | Clone/live disagreement records for the two square families after correcting the live interaction oracle |
| Immutable pending/settled downloads, preserved source/style, actual standalone reopening, final settled-SVG group | Extra dense grids and duplicate render-surface captures beyond an itemized representative core inventory |

Do not reduce test totals or artifact counts as an end in themselves. For each
existing dash case/artifact, state whether it remains required, becomes advisory,
or is superseded by a justified live-oracle observation, and why. Preserve
historical bytes and useful regression tests. Freeze this finite inventory once
accepted; expand it only for a concrete new core regression, not hypothetical
completeness. Existing data safety, import/export fidelity and supported native
interaction gates are not candidates for relaxation.

If adopted, implement the profile consistently across the runner, scenario
contracts, artifact ownership, registered policy tests, documentation and review
criteria. Do not merely catch the exception, remove a count, or make expected
candidates follow actual results. `runPointDashCapChecks` currently blocks the
paint group, which prevents the final settled-SVG group from running. Ensure
advisory diagnostics cannot starve required work: run them separately or after
core groups, with independent status and bounded ownership.

Preserve raw `failed`, `not_run` and `blocked` outcomes. Record acceptance
disposition separately, binding the named profile and exact known limitations
to the checkout and report. Report an accepted outcome as **core acceptance
passed with named limitations**, not complete dash conformity. Unexpected core
failures, missing/stale/malformed core evidence, page errors and unexecuted
required groups must still fail. Add negative policy tests against unrelated
failures being swallowed as a known limitation. Review must assess the same
explicitly accepted scope; unchanged strict review criteria cannot be silently
reinterpreted. Until adoption, the existing strict result remains failed.

## Preserve completed behavior; avoid another expanding investigation

Keep full isolated square/disk dots, outgoing positive-start tangents, exclusion
of terminal-only zero dots, separately capped zero-off intervals, raw source/
pattern/phase precision, bounded arithmetic, effective-style matching, solid
joins and the existing 256-edge circle contour. Preserve terminal negatives
`(21,-21)`, `(22,-22)`, `(22,-18)` and painted `(-22,-22)`; preserve positive-corner
`(20,20)`, `(16,-22)`, `(22,-22)` and exterior `(-22,-30)` in their own cases.
Do not perturb patterns/coordinates, clamp valid zero entries, inflate tolerances
or replace geometry with bounding boxes to obtain green checks.

Keep native visibility diagnostics, trusted-input/restoration assertions, App
continuity, monitor-drain fix, owned cleanup and primary-error retention. Keep
independent paint/import/PGF work, lifecycle races, exact JSON/CRLF, immutable
exports and all earlier completed behavior. Retain the runner's 60-second fixture
deadline and fresh-process policy loading. No retry-until-green, global deadline/
concurrency change, unrelated cleanup, new dependency or 32C/32D work.

Preserve original `epviae` evidence and all failed attempts byte-identically.
Older exploratory generic-cap passes, unfinished `vaZYVU`, `YAt03b`, child EPERM
and the unproven `UThawr` timeout cause remain distinct from current evidence.
Later progress does not retrospectively prove an old failure mechanism.

## Verification, review and stopping condition

Document the live-versus-clone conclusion, the bounded transfer check and the
proposed/adopted profile with its itemized inventory and limitations. Do not
spend another cycle repairing an assertion whose independent live premise is
already disproven. Do not require zero differences across every raster engine
as an implicit prerequisite for finishing independent point paint.

Run registered focused regressions and applicable strict TypeScript, script
syntax, targeted lint and diff checks. Report baseline lint debt and existing
bundle warnings separately. Run `npm test` and `npm run build` sequentially.
Finalize files, then record final identity and evidence paths externally. In the
authorized browser-capable parent, run:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require fresh matching evidence for all five commands and every required group
under the selected policy, including the previously unexecuted final settled
SVG group. Child restrictions remain recorded failures, not substitutes for
parent acceptance; do not bypass permissions. A profile change cannot reuse
an earlier failed run as a new pass. Any subsequent checkout edit requires
matching verification again.

Obtain fresh independent read-only review against the paired review prompt and
any explicitly adopted scope amendment. The finite closing condition is: core
requirements pass on the final identity, all named limitations have an accepted
disposition, and independent review agrees with that same scope. If the proposal
has not been adopted, report the strict blockers and the concrete scope decision
still needed; do not claim acceptance or automatically launch another expansion.
No commit or push without successful required verification/review. 32B currently
remains incomplete; 32C/32D remain deferred.
