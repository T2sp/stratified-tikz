# Phase 32B Targeted Fix Prompt: Preserve paint uncertainty after runtime execution

## Environment and scope

Work on `phase/32b-color-opacity-outline`. Inspect status and preserve all
current production, documentation, package and test changes, including the
untracked execution-boundary PGF fixtures and registered regression file.
At this prompt update HEAD is `0cf3811523b4f8851af73ec6e70b7c2cc2f7feb4`.
The accepted parent verification and independently reviewed checkout match
this pre-prompt fingerprint:

```text
1673235823b56d698409147427446e2d7269ac1f98bee42b3dd07abd15b1aac3
```

This identifies the tree before this prompt edit. Recompute final identity
including tracked changes, untracked files and binary bytes after corrections.
Do not reset, discard or restart the existing implementation.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Fix only the remaining Medium production defect: execution-capable runtime
options can invalidate color bindings and option handlers, yet later options
regain false paint certainty and override correct external TikZ behavior.
Preserve the completed source execution/scope, declaration-limit, handler
boundary and persistence corrections. Keep strict TypeScript, bounded parsing,
existing dependencies and 32A behavior. Do not execute TeX in the importer or
preview, implement a general TeX interpreter, or expand into deferred 32C/32D.

## Accepted verification and remaining review finding

The matching parent verification passed all five commands, including both
required browser commands:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-UD0YeR/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-UD0YeR/05-check-free-labels/artifacts/free-labels-evidence.json
/private/tmp/stz-phase32b-independent-review-EU8oKW/checks.json
```

The review accepts 16 groups, 27 point scenarios and 281 required artifacts,
with no page errors. Before/after identities match the reviewed checkout,
including untracked files. Independent tests on Node v26.9.0 passed 3,441 cases
with zero failures/skips/cancellations. Build, diff, strict production/fixture/
changed-test TypeScript, latest-change ESLint and all 51 script syntax checks
passed. Broader changed-production lint reproduced 11 errors and 4 warnings
already present at baseline; repository-wide lint was not run. The existing
large-chunk build warning remains nonblocking.

Independent review returned `needs_changes`, with zero Critical, one Medium
and zero Low issues, and `ready_to_commit: false`. Browser acceptance is complete
and current for this tree. The remaining blocker is the demonstrated production
export defect below. Do not reclassify it as missing native evidence or reopen
the earlier runner, scroll or App continuity investigations without new evidence.

## Confirmed reproduction and failure mechanism

Import and apply this exact external source:

```tex
\tikzset{myPoint/.style={/utils/exec={\definecolor{red}{HTML}{0000FF}},text=red}}
```

Retained independent evidence:

```text
/private/tmp/stz-review-runtime-exec/commands.txt
/private/tmp/stz-review-runtime-exec/repro.mjs
/private/tmp/stz-review-runtime-exec/runtime.sty
/private/tmp/stz-review-runtime-exec/standalone.tex
/private/tmp/stz-review-runtime-exec/inlineMath.tex
/private/tmp/stz-review-runtime-exec/observations.json
/private/tmp/stz-review-runtime-exec/operators.txt
```

PGF 3.1.11a compilation renders the external node blue (`0 0 1 rg`) and both
application nodes red (`1 0 0 rg`). The generated fragments put
`text=stzPointpText2` after `myPoint`, with `stzPointpText2` defined as `FF0000`.
Inspect the original input, reproduction script, compiler log/PDF and operators
before editing. Preserve these failed artifacts and write corrected evidence
separately.

The top-level parser accepts the stored `.style` body; its declaration-time
boundary does not establish the effects when that body is later invoked.
In `src/model/importedTikzPaint.ts`, `/utils/exec` reaches `invalid()` around
line 274 and marks paint fields unresolved. The resolver nevertheless keeps
using its original color environment and handler assumptions. At the later
`text=red` branch around line 299, it resolves built-in red and removes
`textColor` from `unresolvedFields`. The warning remains, but the exporter
therefore emits an untouched red override.

This is an invocation-time certainty gap. The existing source-wide
`sourceDiagnostics` guard for rejected saved sources already prevents false
recovery in that different path; do not redo the completed top-level scanner
or overflow correction.

## Required targeted correction

1. Establish a conservative bounded policy for unsupported execution-capable
   runtime options. Track loss of binding/handler certainty through resolution,
   or reject affected imports atomically. Do not execute the body, special-case
   its `\definecolor` payload, or assume only the named color can change.
   A warning without preserved uncertainty is not sufficient.
2. Once arbitrary runtime execution may have occurred, later literal-looking
   paint must not resolve against potentially stale built-in/custom colors or
   option handlers. An absolute key such as `/tikz/text` establishes a path,
   not an unchanged handler or color binding. Directory certainty alone cannot
   justify recovery. Retain diagnostics and prevent `resolved()` or another
   path from erasing uncertainty without supported semantic justification.
3. Propagate this state through nested styles, aliases and returns to outer
   option lists. Inspect retained unsupported-mutation dependency paths as well
   as ordinary style bodies: an executable option inside an appended/prefixed
   list must not be ignored merely because that list was scanned only for
   dependencies or directory changes. Keep source dependencies/load hints.
   Bound exhaustion must not permit unvisited executable effects to become
   certain through a later option; keep existing input/work/depth limits.
4. Apply the policy consistently through raw-source reconstruction, existing
   saved references/snapshots, preset application and JSON reload. If imports
   are rejected, require actionable diagnostics and no partial diagram/source/
   reference/preset mutation, and separately protect already-saved sources.
   Neither old snapshots nor a legacy fallback may re-establish false certainty.
5. Preserve untouched external behavior in both `standalone` and `inlineMath`:
   keep the actual external style key and do not append uncertain importer
   fallback paint as an authoritative override. Preserve explicit local edits,
   including an intentional value equal to the visible fallback. Do not infer
   user intent solely from a stale preview or snapshot. Trace this through
   imported paint refresh/editing, serialization and `src/tikz/generateTikz.ts`.

Keep the distinction between arbitrary execution, a demonstrably paint-only
mutation, a directory-only change and an ordinary invalid literal. Preserve
supported literal resolution and justified recovery controls where their
assumptions hold. Do not indiscriminately disable all later-option recovery;
equally, arbitrary executable code must not inherit paint-only recovery rules.
Document any narrowly necessary change to existing recovery expectations.

Preserve exact raw source, key spelling, source order and external load hints
for retained sources. Do not strip executable options from saved/exported
source, replace the external key with flattened paint, hard-code blue for the
reproduction, or suppress the diagnostic to make the output appear correct.

The color-binding side effect above is independently demonstrated. Changes to
option handlers are a risk of arbitrary execution, not a second established
failure in the supplied PDF. Cover that risk with a justified focused regression
or independent reproduction; distinguish new observations from this evidence.

## Registered regressions and independent PGF comparison

Add focused registered tests along the real import → preset/application →
resolution → persistence → export path as appropriate:

- The exact retained reproduction, directly and through a nested style/alias,
  including return to an outer option list. Assert diagnostics and unresolved
  paint, not just the presence of a warning string.
- Execution in a retained mutation/dependency path followed by outer paint.
  Exercise changed work/depth-bound behavior if the correction affects it.
- Later `text`, `fill`, `draw`, `color`, color mixtures and absolute `/tikz/...`
  keys cannot regain certainty from potentially changed bindings/handlers.
  Include a focused handler-side-effect case without executing TeX in tests
  that exercise the application parser.
- Save/load with exact raw source and diagnostics, stale saved snapshots,
  existing-preset reapplication and relevant Undo/Redo. For atomic rejection,
  prove unchanged state and safe handling of already-saved input.
- Explicit local text/fill edits, including fallback-equal values, remain
  authoritative while other untouched uncertain channels stay external.
  In both modes inspect options after the actual external key; a generic
  substring check elsewhere in the output cannot prove correct precedence.
- Supported literal styles, independent resolution without executable effects,
  justified paint-only recovery and directory-only absolute-option recovery
  remain covered. Preserve all completed execution-boundary regressions.

Compile corrected generated output in both modes against the identical
independent `runtime.sty` source. Retain commands, compiler/PGF versions, logs,
PDFs and actual paint operators. The external node must remain blue and
untouched application nodes must no longer force red; intentional local
overrides must retain their requested behavior. If initial import is rejected,
prove atomic rejection and exercise retained-source reload/reapplication to
show that existing diagrams cannot emit the old incorrect overrides.
Do not derive the expected external paint from the application resolver.
Independent compiler checks do not authorize TeX execution in the application.

## Preserve completed work and cumulative acceptance

Keep the closed top-level execution/scope grammar, complete passive-handler
allowlist/argument boundaries, and atomic 512-event limit shared by style,
mutation and color declarations. Preserve rejected-source diagnostics,
source-wide uncertainty, exact saved text and explicit override intent.
Retain the original and corrected PGF fixtures under
`tests/fixtures/point-paint-pgf/execution-boundary/`, including the
`handler-execution/` follow-up, and all registered boundary regressions.
Do not overwrite those references to repair this distinct runtime case.

Preserve the earlier runtime-directory fix, detached provenance cleanup,
independent paint/opacity/dimming, immutable SVG capture, bounded 100-entry
history, raw JSON/CRLF, 2D/3D semantics and free/inline-label behavior.
Keep App geometry/ownership diagnostics, bounded waits, native scroll deadline,
real pointer assertions and all five native geometry fault controls. Keep the
seven App → SVG → App transitions, three continuity controls and 13 artifacts,
directory scenario and 11 artifacts, and six responsive downloads with all
91 responsive artifacts.

Preserve the current 16 groups / 27 point scenarios and every required artifact;
new targeted coverage must supplement the accepted cumulative suite. Keep the
runner's 60-second fixture deadline, bounded owned-process cleanup, failed
evidence retention, fresh-process verifier loading and transitive dependencies.
Do not weaken policy, timeouts or native assertions to pass the new checks.

## Verification, documentation and review

Read `AGENTS.md`, paired 32B implement/review prompts and current
`docs/PHASE_32B_IMPLEMENTATION.md`, `docs/IMPORTED_POINT_PAINT.md` and
`docs/DATA_MODEL.md`. Document the runtime execution certainty policy, its
difference from source rejection/directory-only uncertainty, persistence and
explicit-edit behavior, and actual before/after evidence. Keep changes limited
to this finding and necessary regressions/documentation.

Run focused registered tests, applicable strict production/fixture/test
TypeScript, changed-script syntax, targeted lint and `git diff --check`.
Run `npm test` and `npm run build` sequentially because they share asset
preparation. Distinguish the established baseline lint diagnostics and build
chunk warning from new failures; do not perform unrelated cleanup.

The UD0YeR parent report is accepted for the pre-fix tree. Subsequent production
changes need fresh matching verification. Finalize code, tests and tracked
documentation before the final run; record identity and report paths in an
external handoff. Then run:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands and current cumulative native evidence on the same
final tree, including tracked/untracked/binary identity. Any checkout change
after verification requires matching verification again. Obtain independent
read-only review of that verified tree against `prompts/phase-32b-review.md`,
explicitly reassessing this runtime-execution finding with the corrected
independent PGF evidence. `32B verify` itself does not perform review.

Do not commit or push while the finding or either gate remains unsuccessful.
32B stays incomplete until the defect, verification and review are resolved;
32C/32D remain deferred.
