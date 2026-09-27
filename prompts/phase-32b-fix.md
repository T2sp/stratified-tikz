# Phase 32B Targeted Fix Prompt: Detect executable values of recognized paint keys

## Environment and scope

Work on `phase/32b-color-opacity-outline`. Inspect status and preserve all
current production, documentation, package, browser/policy and test changes,
including the 50 untracked runtime-execution PGF fixture and regression files.
At this prompt update HEAD is `bb8fc874c7802ecdcfa4732ddb903d3cd4608d4d`.
The accepted parent verification and independently reviewed checkout match
this pre-prompt fingerprint:

```text
df0d1cb9183b85a216a665c849d882c95716e2e98d3c3fce7eee7edf894105b5
```

This identifies the tree before this prompt edit. Recompute final identity
including tracked changes, untracked files and binary bytes after corrections.
Do not reset, discard or restart the existing implementation.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Fix only the remaining Medium production defect: executable TeX inside a
recognized paint key's value bypasses the existing execution-uncertainty guard.
Extend the current value-classification boundary and preserve the completed
runtime-key, source execution/scope, declaration-limit and override-intent
corrections. Keep strict TypeScript, bounded parsing, existing dependencies and
32A behavior. Do not execute TeX in the importer/preview, implement a general
TeX interpreter, or expand into deferred 32C/32D.

## Accepted verification and remaining review finding

The matching parent verification passed all five commands, including both
required browser commands:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-XSgoUN/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-XSgoUN/05-check-free-labels/artifacts/free-labels-evidence.json
/private/tmp/stz-phase32b-review-FfO6bB/parent-evidence-match.json
```

The review accepts all 16 cumulative groups, 27 point scenarios and 281 required
artifacts, with no page errors. Before/after identities match the reviewed
checkout, including all 50 untracked files. Independent Node v26.9.0 tests
passed 3,535 cases with zero failures/skips. Build, strict production/test
TypeScript, focused ESLint, script syntax and `git diff --check` passed.
Local logs are under `/private/tmp/stz-phase32b-review-FfO6bB/`.
Repository-wide lint was not run; sampled unchanged baseline files demonstrate
separate debt of 36 errors and four warnings. The existing build chunk warning
remains nonblocking.

Independent review returned `needs_changes`, with zero Critical, one Medium
and zero Low issues, and `ready_to_commit: false`. Native acceptance is complete
and current for this tree. The remaining blocker is the production defect below;
do not reopen the earlier runner, scroll or App continuity investigations or
reclassify this finding as missing browser evidence.

## Confirmed reproduction and failure mechanism

Import and apply the exact retained external source:

```tex
\tikzset{myPoint/.style={
  line width={+1pt\relax\globalcolorstrue\definecolor{red}{HTML}{0000FF}},
  text=red
}}
```

Retained independent evidence:

```text
/private/tmp/stz-review-paint-value-exec/commands.txt
/private/tmp/stz-review-paint-value-exec/repro.mjs
/private/tmp/stz-review-paint-value-exec/runtime.sty
/private/tmp/stz-review-paint-value-exec/resolver.json
/private/tmp/stz-review-paint-value-exec/observations.json
/private/tmp/stz-review-paint-value-exec/operators.txt
```

The directory also retains both generated fragments, successful compiler logs,
PDFs and a SHA256 manifest. Inspect these before editing and preserve the
original artifacts unchanged. PGF 3.1.11a compilation succeeds: the external
node is blue (`0 0 1 rg`), while both generated application modes force red
(`1 0 0 rg`) without any local edit.

The current `resolver.json` shows `textColor: "#FF0000"`, only `lineWidth` in
`unresolvedFields`, and no `executionUncertain`. Its warning says the width
option is unsupported or invalid; that warning does not preserve external
paint authority.

In `src/model/importedTikzPaint.ts`, `hasExecutableLayoutValue()` around line
197 limits value checks to `deferredShapeLayout` keys. Both ordinary `visit()`
and `collectOptionDependencies()` call this restricted predicate. `line width`
is recognized paint, so it also bypasses the unknown-key execution guard.
The dimension branch around line 383 rejects its nonliteral value, but
`invalid()` marks only `lineWidth` unresolved. Binding/handler certainty stays
true, and subsequent `text=red` resolves against the stale built-in binding.
The exporter then appends an untouched red override after the external key.

The existing `loseExecutionCertainty()`, guarded `resolved()`, nested/dependency
propagation, source-hint retention and recorded-override handling already solve
the earlier runtime-key case. This follow-up extends their detection boundary;
do not replace that machinery or redo the top-level scanner/overflow fixes.

## Required targeted correction

1. Classify execution-capable values of recognized paint keys as well as the
   existing runtime-key and deferred-layout cases. Apply the bounded policy
   before field-specific literal parsing can classify executable input as an
   ordinary invalid scalar. Cover the recognized key families and their
   supported normalized/absolute spellings; do not patch only `line width`
   or match the exact `\definecolor` payload.
2. Use the same classification rule in ordinary option resolution and retained
   mutation/dependency scans. Carry it through nested styles/aliases, appended
   or prefixed lists and return to outer options, including paths where the
   invocation directory is already unknown. Preserve current input, work,
   depth, cycle and diagnostic budgets; do not create an unbounded second scan.
3. Route detected executable values through the existing sticky execution
   uncertainty: potentially changed color bindings and option handlers remain
   unknown for that invocation. Retain `executionUncertain`, affected unresolved
   paint and actionable diagnostics/source hints. Later relative or absolute
   `/tikz/...` options must not clear this state or apply stale bindings.
   A warning plus unresolved width alone is insufficient.
4. Keep ordinary invalid, non-executable literals field-specific. A failed
   dimension/opacity/color parse alone does not imply arbitrary execution.
   Preserve later supported recovery for such values and valid braced literals.
   Do not solve the defect by marking every parse failure globally uncertain
   or by treating braces alone as executable syntax.
5. Preserve exact raw source, reference spelling, external load hints and
   source order through preset application, refresh, save/reload and history.
   Saved references and stale snapshots must reconstruct the same uncertainty.
   Use the existing recorded local override intent, including fallback-equal
   edits; do not infer new local intent from an old resolved/fallback value.
6. In both `standalone` and `inlineMath`, retain the actual external key and
   omit untouched uncertain paint after it. Explicit recorded local edits
   must remain effective while untouched channels stay external. Check the
   complete import/application/resolution/serialization/export path rather
   than changing only the warning text.

Keep TeX opaque. Do not execute values, interpret the color-changing payload,
truncate the width at its numeric prefix, strip executable tokens from saved
source, hard-code blue, or flatten the external style into preview paint.
The supplied compiled evidence proves the exact width case. Tests of other
recognized value families establish the conservative detection boundary; do
not claim independent PGF confirmation for variants that were not compiled.

## Registered regressions and independent PGF comparison

Add focused registered regressions using the existing production helpers:

- The exact source above, retaining its leading `+1pt` and all control
  sequences. Assert sticky `executionUncertain`, unresolved paint and useful
  diagnostics, not only a failed width parse or a warning string.
- Direct resolution, nested/aliased styles and `.append style` / `.prefix style`
  retained-list paths, followed by outer `text=red` and absolute `/tikz/text`.
  Exercise both ordinary and dependency-only detection paths.
- Execution-capable syntax in recognized dimension, opacity, color/mixture,
  dash and cap/join values, with relevant braced/unbraced and `/tikz/...`
  forms. Cover shared classification boundaries without adding TeX evaluation.
- Valid braced literals and ordinary invalid controls: invalid plain width
  followed by valid width/text, out-of-range opacity followed by valid opacity,
  and unsupported plain color followed by known color. These must retain
  established field-specific diagnostics and justified recovery.
- Exact raw-source/diagnostic save and reload, stale saved snapshots, existing
  preset reapplication and relevant Undo/Redo. Test explicit local text/fill
  edits, including values equal to the fallback, and preservation of untouched
  uncertainty through refresh and first editing.
- Both output modes, inspecting options after the actual external key. Untouched
  paint must not force the old red; explicit edits must retain precedence.
  Preserve existing runtime-key, deferred-layout, bound-exhaustion, paint-only
  mutation, directory-only recovery and rejected-saved-source controls.

Compile corrected generated output in both modes against the byte-identical
retained `runtime.sty`, placing corrected evidence separately from the failing
review directory. Keep commands, compiler/PGF versions, exit results, logs,
PDFs and actual paint operators. The external node must remain blue; untouched
application nodes, including reload/reapplication cases, must no longer force
red. Demonstrate that recorded local edits retain their requested behavior.
Expected external paint must come from the independent PGF result, not from
the application resolver. Independent compilation does not authorize TeX
execution in the application.

## Preserve completed work and cumulative acceptance

Keep the closed source execution/scope grammar, passive-handler allowlist and
argument boundaries, atomic 512-event limit, rejected-source diagnostics and
source-wide uncertainty. Preserve the existing invocation-time execution flag,
unknown-key/handler/layout protections, bounded dependency traversal and
recorded override-intent behavior. Retain all earlier failing/corrected PGF
fixtures under `tests/fixtures/point-paint-pgf/execution-boundary/`, including
`handler-execution/` and `runtime-execution/`, and their registered tests.
Do not overwrite those references to repair this value-classification gap.

Preserve independent paint/opacity/dimming, immutable SVG capture, detached
provenance cleanup, the bounded 100-entry history, exact raw JSON/CRLF, 2D/3D
semantics and free/inline-label behavior. Keep App geometry/ownership diagnostics,
bounded waits, native scroll deadline, pointer assertions and all five geometry
fault controls. Retain seven App → SVG → App transitions, three continuity
controls and 13 artifacts, the directory scenario and 11 artifacts, and six
responsive downloads with all 91 responsive artifacts.

Keep the current minimum of 16 cumulative groups / 27 point scenarios and all
required artifacts, including the strengthened missing-dependency execution-
uncertainty assertions. New targeted tests must supplement accepted coverage.
Keep the runner's 60-second fixture deadline, owned-process cleanup, failed
artifact retention, fresh-process verifier loading and transitive dependencies.
Do not weaken policy, timeouts or native assertions to pass this correction.

## Verification, documentation and review

Read `AGENTS.md`, paired 32B implement/review prompts and current
`docs/PHASE_32B_IMPLEMENTATION.md`, `docs/IMPORTED_POINT_PAINT.md` and
`docs/DATA_MODEL.md`. Document the recognized-value execution boundary and its
difference from ordinary invalid literals, the exact before/after observations,
persistence and explicit-edit behavior. Keep changes limited to this finding
and necessary regressions/documentation.

Run focused registered tests, applicable strict production/fixture/test
TypeScript, changed-script syntax, targeted lint and `git diff --check`.
Run `npm test` and `npm run build` sequentially because they share asset
preparation. Distinguish established baseline lint debt and the build chunk
warning from new failures; do not perform unrelated cleanup.

The XSgoUN report is accepted verification of the pre-fix tree. Subsequent
production changes require fresh matching verification. Finalize code, tests
and tracked documentation before the final run; put final identities and
report paths in an external handoff. Then run:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands and current cumulative native evidence on that same
final tree, including tracked/untracked/binary identity. Any checkout change
after verification requires matching verification again. Obtain independent
read-only review of the verified tree against `prompts/phase-32b-review.md`,
explicitly reassessing this executable-value finding with corrected independent
PGF evidence. `32B verify` itself does not perform review.

Do not commit or push while the finding or either gate remains unsuccessful.
32B stays incomplete until the defect, verification and review are resolved;
32C/32D remain deferred.
