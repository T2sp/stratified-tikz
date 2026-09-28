# Phase 32B: final bounded correction and deferred issues

## User decision and stopping point

The user requested one further correction based on `Y7voeD`, then a written
handoff of unresolved problems before moving on. That bounded correction has
been made. **Stop the 32B repair loop here.** This file is now a residual-issue
record, not an instruction to start another implementation pass automatically.
Later work may proceed at the user's direction with the limitations below.

32B is not being relabelled fully verified. The strict verification policy is
unchanged, and `stz-32b-core-v1` remains unadopted. Deferring unfinished work is
distinct from changing failed results to passes. No 32C/32D implementation,
commit or push was performed in this pass.

## Correction made in this pass

The latest parent `Y7voeD` failed only the two `square-zero-off` App rows at
scales `.5` and `1.5`, at `exact-1`, local `(16,-22)`. The point is unpainted
there but its connected live paint is approximately `3.031411` units away.
The independent six-unit candidate region includes both `control` and `p`.
Ordinary SVG clicking hits the painted control; Alt cycling reaches `p` and
`control`. Requiring the ordinary selection to be `p` was an incorrect contract.

`scripts/pointDashCapContract.mjs` now declares that exact witness a proximity
hit. It requires connected background, native exclusion, non-interior position
and paint distance strictly between `.14` and `5.86`; ordinary selection must be
`control`, while every action still has both candidates and Alt reaches both.
Other painted and exterior expectations are unchanged. The synthetic fixture
and registered both-scale positive/negative tests were updated. Production
geometry, click behavior, tolerance, import/export behavior and active scope
were not modified.

The 173 focused contract tests pass. Read-only replay accepts all 22 retained
App observations under the corrected contract, without modifying historical
files or calling that replay fresh native acceptance. The independent review
of this limited change found no substantive issue.

## Remaining issues

### 1. Closed-path dash proximity disagreement

The strict supplemental `positive-full-closed-control` remains unresolved:
literal triangle `0,0 24,0 12,16`, width 12, square caps, bevel joins, pattern
`[100,100]`, phase 1. The positive interval covers the closed path. The retained
native grid has 24 omissions. At `(0,-14)`, live paint is about `5.7732207757`
units away but production distance is 8, outside the six-unit candidate region.

The formerly blocked four-shape transfer was actually run in this pass using
Chrome 154.0.8037.57 on Node v26.9.0. It retained these discrepancies on supported
contours with one size/setting (width 10pt/12 local units, square caps, bevel
joins, raw pattern `[100/1.2,100/1.2]`, phase `1/1.2`):

| Shape | Candidate omissions | First exercised witness | Live paint distance |
| --- | ---: | --- | ---: |
| Triangle | 20 | `(2,-24)` | 5.84584 |
| Square | 7 | `(10,-16)` | 5.03135 |
| Star | 12 | `(-4,-20)` | 5.28578 |
| Circle | 6 | `(14,-10)` | 5.04375 |

All 45 differences are omissions, not false positive hits. The first disputed
witness for each shape has empty candidates under trusted ordinary and Alt
clicks. The exterior `(-40,-40)` is correctly excluded. Source/model/history
and original framing restore unchanged. Preserve emitted floating-point dash
attributes `100.00000000000001` exactly.

Evidence limit: the paint oracle uses connected magnified screenshots at CTM
scale 16; native actions use independently checked scale 1. No action-time
scale-1 paint capture establishes rendering invariance across those scales.
Record these as unresolved supported-shape transfer discrepancies, not four
completed acceptance results or a claim about every ordinary workflow. Any
later investigation should first resolve this same-setting framing question,
not launch another arbitrary-polygon/engine sweep.

The existing conditional core-profile proposal assumed successful transfer
without a supported-workflow discrepancy. These results do not satisfy that
condition. The user's decision here permits carrying the open issues forward;
it does not automatically adopt that earlier proposal.

### 2. Transfer harness cannot reopen the saved SVGs

All four rows subsequently fail with `Please use browser.newContext()` at
`scripts/checkPointClosedDashTransfer.mjs:153`. The entry point creates its page
with `browser.newPage()`, whose owned context cannot create the second page
requested by `page.context().newPage()`.

Each `.export.svg` was saved, but standalone reopening and its assertions did
not execute. This later error becomes the headline failure before the earlier
retained `actionFailure` is rethrown, obscuring the candidate omissions in the
terminal summary. Both errors remain in the per-shape records. A future targeted
harness repair should explicitly own a browser context and preserve primary
failure ordering. It was deliberately not folded into a second repair cycle.

### 3. Complete strict browser acceptance remains outstanding

The fresh strict `WlO99Z` run used the code/test identity below. All **4,451 tests**
passed (zero failed/skipped/cancelled), followed by build, diff and label-assets.
`check:free-labels` still failed, now solely at the supplemental full-closed
witness `(0,-14)`. **All 22 App dash entries passed**, including both corrected
zero-off proximity rows; **20/21 supplemental mechanisms passed**.

Fourteen of sixteen cumulative groups completed, with no page errors. The
paint/import group remains incomplete because its supplemental assertion fails;
`settled-SVG-export-standalone` did not execute. These are remaining strict
acceptance gaps, not another failure of the corrected ordinary-selection role.
The separate transfer also remains failed for the reasons above. No further
implementation change or retry-until-green was performed after these results.

The separate transfer's serialized-SVG check is not a substitute for actual
App downloads and the final settled-SVG standalone group. A missing or
unexecuted group remains an evidence gap. The capture isolation work is
preserved; old child EPERM results do not describe this pass's successful
Chrome startup.

## Evidence and identity

Implementation verification targets HEAD
`f8213c4d3d76059b903b6e946269aa18f6b46845`, code/test fingerprint:

```text
f0db8c560e188b0822a53cd9e2cfc716d7dd215fa4f18de82d2ac34a623b9472
```

This residual-issue document was finalized after that verification. The external
handoff records both identities and authenticates that the only subsequent
checkout change was this Markdown file; do not claim a fresh strict pass for
the later full-tree identity.

- [Final handoff and verification details](/private/tmp/stz-32b-one-pass-fYEVjj/HANDOFF.md)
- [Final strict verifier report](/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-manual-WlO99Z/verification.json)
- [Verifier worker handoff](/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-zjhnnB/response.json)
- [Four-shape transfer report](/private/tmp/stz-32b-one-pass-fYEVjj/transfer/transfer-run.json)
- [Transfer grids, native actions, saved exports and errors](/private/tmp/stz-32b-one-pass-fYEVjj/transfer/closed-dash-transfer.json)
- [Original parent failure](/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-Y7voeD/verification.json)

All original failures remain historical evidence. Existing unrelated tracked
changes and untracked capture-isolation files are preserved. Do not reset prior
work, restore the rejected generic seam cap, inflate tolerance, or alter raw
patterns merely to make a remaining diagnostic pass. Revisit the listed items
only when explicitly scheduled; this pass ends with an honest incomplete
32B handoff.
