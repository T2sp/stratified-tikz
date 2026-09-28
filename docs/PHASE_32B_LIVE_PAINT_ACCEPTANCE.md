# Phase 32B connected paint and bounded acceptance

Status: the finite core profile below is **proposed, not adopted**. The active
acceptance policy remains strict. Correcting a disproven interaction oracle
does not waive a production defect or certify exported paint. 32B remains
incomplete; 32C/32D remain deferred.

## Preserved checkout and evidence

This continuation actually starts on clean
`8953e01c9c6b11731c44ea86b08564766f684d3c`, with fingerprint
`b31dbcb8c7cbfb23033dabc103bbf30e89f9e363dcf5730502f7f28cda007307`.
That prompt-update commit is the direct child of the supplied
`beae63a78adb1e65608f6cce7b71da66e3cf5033`. It records all twenty previous
tracked changes and all thirty-one previous untracked files, plus the updated
fix prompt. The original tracked diff and all thirty-one hashes match the
handoff exactly. No reset, commit or push is performed in this continuation.

The parent `pF6DA7` run is real native evidence on the preceding fingerprint
`2054380c655ef083aa18be381508ece020cef5484b80b004d0b214b144aef9d7`, not a
browser startup failure. Node v26.9.0 and Chrome 154.0.8037.57 ran all twenty-two
App entries (eighteen passed, four failed) and all twenty-one supplemental
entries (eighteen passed, three failed). Tests (4,366), build, diff check and
label-assets passed. Free-labels failed with fourteen of sixteen groups
completed, paint/import incomplete, the final settled-SVG group unexecuted,
and no page errors.

The complete failure inventory is:

| Observation | Failed entries |
| --- | --- |
| App at both `.5` and `1.5` responsive scales | `square-zero-off`, `square-positive-before-corner` |
| Supplemental mechanisms | `zero-off-continuous`, `positive-before-corner`, `positive-full-closed-control` |

The first error is zero-off `.5`, ordinary `audit-cap` at `(22,-22)`: actual
candidates `['control']`, expected `['control','p']`. The before-corner failed
paint witness is `(22.90625,-22.90625)`. The terminal stack does not replace
the matrices. Terminal, exact-positive, isolated/internal-zero, circle, star
and triangle progress remains preserved.

All 3,687 original `epviae` evidence files were reauthenticated unchanged.
The retained `pF6DA7` reports, complete matrices, source/clone/solid rasters,
engine audits, connected screenshots and ordinary/Alt action records are
hashed separately. Earlier exploratory generic-cap passes, unfinished `vaZYVU`,
`YAt03b`, child EPERM and the unproven `UThawr` timeout cause remain distinct.
No later observation retrospectively establishes an earlier failure mechanism.

## Live paint corrects the interaction premise

Before changing assertions, an independent Python PNG decoder recalculated
Euclidean distance to the retained scale-sixteen connected literal SVG paint.
It imports no production geometry helper. It uses composited black pixels,
boundary pixel centers inverted through the recorded CTM, and the unchanged
six-unit picking tolerance and `.14` uncertainty. The independently observed
continuous-stroke control and contour interiors remain part of the expected
selection region.

The calculation is retained at
`/private/tmp/stz-phase32b-live-oracle/mechanism-transfer/recalibrate.py`, with
source/PNG/calculation hashes, dimensions, CTM, computed style, all grid rows,
counts and witnesses in `retained-live-recalibration.json` beside it.

| Mechanism | Historical clone discrepancies | Definite connected-live grid discrepancies |
| --- | ---: | ---: |
| `zero-off-continuous` | 24 | 0 |
| `positive-before-corner` | 39 | 0 |
| `positive-full-closed-control` | retained separately | 24 |

The twenty-four zero-off and thirty before-corner opaque-clone/core
contradictions are background in retained live paint. The original 24/39
clone-based grid differences are therefore not established unclickable visible
App paint. This is an offline recalibration of historical evidence, not a new
native pass and not proof of every workflow.

Background is not a negative interaction oracle. At `(16,-22)`, zero-off live
paint is about `3.0314` local units away, so the point remains a required hit.
For before-corner the live distance is about `7.1153`, with continuous-stroke
distance `7.0712`, so it is a definite miss. Interiors and intentional selection
through dash gaps remain selectable. Selection decoration has its separate
allowance; it does not increase the six-unit picking tolerance.

The retained magnified App image also includes an editor Select overlay and
fixture UI. An unmasked whole-image black-pixel distance would incorrectly
count that unrelated paint. App evidence must isolate the connected point's
paint with owned, restored presentation changes, or use a justified bounded
unobstructed region. It must bind source/PNG hashes, dimensions, style, CTM,
viewport/scale, positive and background calibration, and restoration to the
same point state used by the trusted ordinary/Alt actions.

Clone raster, connected live pixels, native `isPointInStroke`, and production
geometry remain separate observations. Neither native containment nor the
production distance helper defines the expected candidate set. A control
overlapping the point must not mask an extra or missing `p`. Cloned render
surface disagreement remains diagnostic evidence. Actual downloaded SVG
appearance, source/style preservation and standalone reopening remain their
own required checks.

## Remaining real discrepancy and transfer boundary

`positive-full-closed-control` is the literal triangle `0,0 24,0 12,16`, width
12, square caps, bevel joins, pattern `[100,100]`, phase 1. Its positive interval
covers the closed path. The connected-live recalibration retains twenty-four
definite omissions. At background coordinate `(0,-14)`, actual paint is
`5.7732207757` units away while production distance is 8. That is a real
near-paint miss under the unchanged six-unit tolerance.

This exact arbitrary triangle is not a supported regular point contour. A
bounded supported-shape transfer check is required before deciding its normal
editing/export impact. An unavailable native transfer result is pending evidence,
not evidence that ordinary workflows are unaffected. A demonstrated supported
workflow miss requires a narrow fix or a further explicit scope decision.

The separate [bounded transfer entry point](../scripts/checkPointClosedDashTransfer.mjs)
uses exactly the current triangle, square, star and circle, one size, width
10pt (12 local units), raw pattern `[100/1.2,100/1.2]`, phase `1/1.2`, square
caps and bevel joins. The source retains the actual converted dash entries
`100.00000000000001`; the nominal `[100,100]` mechanism does not justify
rounding saved inputs or emitted attributes. Their production contour perimeters are respectively
about `51.9615`, `40`, `45.3583` and `31.4159`, all below the remaining positive
interval 99. These styles and contours are expressible in the current model;
that static reachability is not a native interaction result. The check retains
connected paint and continuous controls, genuine exterior `(-40,-40)`, trusted
ordinary/Alt candidates, exact model preservation and serialized SVG reopening.
It is a separate four-shape investigation, not a new cumulative scenario.

One native attempt failed at `development-server-listen`,
`listen EPERM: operation not permitted 127.0.0.1:5173`. All four cases are
`not_run`; no Chrome page existed. The report and exact attempt identity are at
`/private/tmp/stz-phase32b-live-oracle/mechanism-transfer/native-attempt/transfer-run.json`.
The final script receives static checks, but this attempt does not verify later
script edits. No retry or permission change was made. Supported native impact
and the named limitation's disposition therefore remain **pending**, not waived.

The authorized parent can execute this same bounded check with:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/checkPointClosedDashTransfer.mjs
```

Its outcome must be reviewed before accepting the conditional triangle deferral.
Do not repeat an arbitrary-polygon or rendering-engine sweep.

The rejected generic initial/terminal seam cap remains rejected. It inflated
the retained triangle dash-phase radius from about `28.42645` to `30.4021`
against native raster `28.39994`, and created phantom hits at `(-6,-34)` and
`(0,-32)`. Both negative controls and all corroborated terminal/positive fixes
remain. No pattern/coordinate perturbation, valid-zero clamping, larger
tolerance or bounding-box picking is authorized by this investigation.

## Proposed decision

Proposed profile name: `stz-32b-core-v1`. Adoption requires an explicit user decision;
the current prompt is not that decision. The itemized inventory is a proposal
only and must be implemented consistently in runner contracts, artifact
ownership, registered policy tests and review criteria if adopted.

The [exact proposed inventory](PHASE_32B_CORE_INVENTORY.json) lists all 856
baseline artifacts: 386 earlier artifacts, 301 App dash artifacts and 169
supplemental artifacts. Every path has its current required status, proposed
role, reason and historical availability/hash. It includes all 22 App and 21
mechanism identities, all 16 groups and all 29 scenarios. Proposed baseline
roles are 646 required, 206 advisory and four clone-raster interaction-oracle
roles superseded by connected paint. Superseded image bytes stay diagnostic.
The addendum specifies four corrected case/scale states using existing live,
live-zoom and seven preaction screenshots per state, with no new artifact paths
or capture matrix. Their source/PNG/style/CTM/calibration/action bindings remain
required. These counts describe evidence roles and are not reduction targets.

The proposed core still requires valid aggregate inventories with every raw
diagnostic outcome. Non-gating conformance does not make missing or malformed
diagnostic ownership acceptable. Fourteen historical baseline artifacts are
absent in `pF6DA7`, including six proposed-core before-corner action screenshots;
even an adopted profile could not relabel that old run as passed.

Keep all five verification commands, all cumulative Phase 31F/32A groups and
the 32B paint/import group, and all twenty-nine scenario identities. Keep normal
editing, native paint/opacity/style, data/history, imports, independent PGF
references, 2D/3D/work planes, responsive interaction, and immutable actual
downloads/standalone reopening mandatory. Keep all twenty-two App dash entries
and corroborated solid-join/dash-cap positive/exterior regression controls.

Treat exhaustive dash-seam equivalence between rendering surfaces, extra dense
grids/duplicate captures and arbitrary polygon/engine research as separately
owned diagnostics. Retain the exact full-closed triangle row as a named followup
limitation only if the bounded transfer check demonstrates no supported
workflow defect. Otherwise its disposition remains unresolved.

No test total or artifact count is itself a reduction target. Preserve
historical bytes and useful registered regressions. Once adopted, freeze the
finite inventory and extend it only for a concrete new core regression.

Raw `failed`, `not_run` and `blocked` observations must stay intact. An accepted
disposition must separately bind the profile, exact limitations, checkout and
verification report. Advisory work must run after, or separately from, core
groups so it cannot starve the final settled-SVG group. Unexpected core
failures, missing/stale/malformed evidence, page errors and unexecuted required
groups must still fail. Negative policy tests must reject unrelated failures
misclassified as known limitations. An accepted result may say **core acceptance
passed with named limitations**, never complete dash conformity.

Until adoption, the strict result remains failed and all current strict gates
remain required. No earlier failed run can become a new profile pass.

## Final verification boundary

Finalize checkout files before verification. Record the final binary-aware
tracked/untracked identity, preservation results, focused/strict/static checks,
sequential tests/build, fresh verification and independent read-only review
outside the checkout under `/private/tmp/stz-phase32b-oracle-followup/`.

The authorized browser-capable parent must run:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

All five commands and every required group, including final settled SVG, require
fresh matching evidence. Child browser restrictions are retained failures, not
substitutes for parent acceptance. Any later checkout edit requires matching
verification again. Review must use the paired review prompt and only an
explicitly adopted scope amendment. No commit or push is permitted without
successful required verification and review.
