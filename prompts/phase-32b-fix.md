# Phase 32B Targeted Fix Prompt: Clear detached point provenance and retain uncertainty from unsupported style mutations

## Environment

Work on the current Phase 32B checkout (reported branch:
`phase/32b-color-opacity-outline`). Inspect status and preserve existing work,
including untracked editing helpers, import harness/tests and PGF artifacts.
Keep the implemented local override intent, shared import context, color-shadowing
and browser-verification corrections. Do not reset or restart implementation.

The accepted parent and independent review checked revision
`d3f86a85b9c5ded504496e50467d96b0bc021fc5` plus working-tree changes, with this
unchanged fingerprint:

```text
2fcf764109737beb6b1fd02b66d3f5178338a1adb2a4c9480ea1a5a111a9ad0d
```

This matches the inspected checkout before this prompt update. Obtain fresh
matching evidence after the correction, including untracked files and binaries.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Fix only the two demonstrated Phase 32B defects below and their necessary
regressions/acceptance coverage. Preserve 32A behavior and defer 32C/32D.
Keep strict TypeScript and bounded literal parsing. Avoid new dependencies and
unrelated lint cleanup. Do not execute arbitrary TeX/PGF in the importer or
preview; focused independent PGF verification fixtures remain in scope.

## Accepted verification and current review findings

Verification passed, and independent review accepted the matching browser and
PGF evidence. Two Medium production defects remain. The earlier three import/
override findings have corrections and mandatory native coverage that must
remain intact; this follow-up does not restart those implementations.

Review:

```text
/Users/takamatoshinori/.codex/attachments/f064661d-9e51-417c-bc54-14323ff3e8d5/pasted-text.txt
```

Accepted parent report:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-4OOIEu/verification.json
```

Independent review logs and concrete reproductions:

```text
/private/tmp/stz-32b-independent-review.mMb61h
/private/tmp/stz-phase32b-ui-review/clear-imported-point.mjs
/private/tmp/stz-phase32b-ui-review/clear-imported-point.log
/private/tmp/stz-32b-review-append-o16tsp/reference.tex
/private/tmp/stz-32b-review-append-o16tsp/observations.json
/private/tmp/stz-32b-review-append-o16tsp/pdf-operators.txt
```

| Observation | Accepted result |
| --- | --- |
| Full suite | 3,086 passed; zero failures/skips |
| Build / diff / both browser checks | Passed |
| Browser / Node | Chrome 154.0.8037.57 / Node v26.9.0 |
| Free-label groups / point scenarios | All 16 / all 23 |
| Browser evidence records / page errors | 167 / none |
| Required PGF evidence | Present and accepted |
| Independent review | needs changes; 0 Critical, 2 Medium, 0 Low |
| Commit readiness | No, due to the defects below |

Strict production, fixture and focused test TypeScript checks passed. All eight
changed JavaScript syntax/lint checks passed. Focused TypeScript lint found two
existing InspectorField.tsx errors reproduced at HEAD; the other 20 files were
clean. Keep existing lint debt and the build chunk-size warning separate from
these functional defects.

### 1. Clear TikZ style leaves detached provenance in point paint

Apply an imported point preset, then choose **Clear TikZ style**. The shared
single/multi-selection action removes `stylePresetId` and
`importedTikzStyleReferenceId` but leaves `style.importedPaint`.

The reproduction reports:

```text
strata[0].style.importedPaint.referenceId
Imported paint metadata must match the active imported reference.
```

The diagram is invalid immediately after clear, serialized JSON cannot reload,
undo restores validity, and redo restores the invalid state. Validation is
correct: provenance must not refer to a detached imported style.

`src/ui/contextQuickStyleBar.ts` routes both single and multi-selection clear
through `clearContextQuickStylePresetReferences()` and `clearStyleReferences()`.
The latter only deletes the two reference fields. Existing quick-bar clear
coverage exercises curves and misses the new point provenance.

### 2. Unsupported mutations leave an earlier external definition falsely resolved

Import and apply:

```tex
\tikzset{
  myPoint/.style={fill=red,text=red},
  myPoint/.append style={fill=blue,text=blue}
}
```

The parser warns about the unsupported append entry but discards it. The shared
context reconstructs the earlier red definition as fully known; reference
diagnostics are empty and unresolved paint is absent. Both TikZ modes then
emit red fill/text overrides after `myPoint`, despite no local edits.

The independent PGF 3.1.11a reproduction compiled successfully. Its source,
PDF and uncompressed operators show the external `PGF` node blue and the
generated `APP` node red. This is an export mismatch, not a missing browser
artifact or a requirement to implement every PGF handler.

## Required reading

Read `AGENTS.md`, the paired 32B implement/review prompts and current
`docs/IMPORTED_POINT_PAINT.md`, `docs/DATA_MODEL.md` and
`docs/PHASE_32B_IMPLEMENTATION.md`. Trace:

- `src/ui/contextQuickStyleBar.ts`, `ContextQuickStyleBar.tsx`,
  `bulkEditing.ts` and `undo.ts`;
- `src/model/styles.ts`, especially `pointStyleForImportedReference()`,
  and `src/model/pointPaintEditing.ts`;
- point provenance validation, cloning, serialization and preset/reference
  replacement paths;
- `src/model/importedTikzStyles.ts`: declaration scanning/deduplication,
  `createImportedTikzResolutionContext()`, saved-reference fallback and snapshots;
- `src/model/importedTikzPaint.ts` and imported-point export in
  `src/tikz/generateTikz.ts`;
- `tests/ui/contextQuickStyleBar.test.ts`,
  `tests/model/pointPaintIntent.test.ts`,
  `tests/model/pointPaintImportContext.test.ts` and
  `tests/tikz/pointImportedResolution.test.ts`;
- `scripts/checkPointImportedPaint.mjs`, its fixtures, and cumulative policy in
  `scripts/automation/phase-verification.mjs`.

Review line numbers were approximately contextQuickStyleBar.ts:829 and
importedTikzStyles.ts:517. Locate current equivalents if they move.

## Required correction

### 1. Clear provenance atomically with the point's external association

Fix the shared single/multi-selection clear action. A cleared point must lose
its preset reference, external reference and associated `style.importedPaint`,
while retaining every explicit style/paint value, overall opacity, shape/size,
raw body text, coordinates and other unrelated data.

Reuse the existing `pointStyleForImportedReference(style, undefined)` semantics
where practical: it clones point paint and removes incompatible provenance.
Keep the change immutable; do not modify the input diagram, source preset,
unselected points or prior history snapshots. Preserve clear behavior for other
strata and labels.

Inspect equivalent reference-detachment paths for this same invariant, but do
not clear provenance during ordinary paint edits that intentionally retain an
external reference. Distinguish the quick bar's actual detachment helper from
similarly named helpers that only clear a preset association.

Do not weaken validation, suppress reload errors, repair only at serialization,
reset paint to defaults, or remove unrelated imported source/preset records.
The editor state must be valid immediately after the action.

Add regressions through the actual action and history functions:

- Single imported point clear, including the exact supplied reproduction.
- An imported point with locally edited independent paint: all channel colors/
  alphas, enablement, width/style/phase/cap/join and optional dash pattern survive.
- Multi-point clear, with an unselected imported point unchanged.
- Immediate validation and successful serialize/reload for cleared states.
- Commit, undo and redo: one effective clear action, valid diagrams throughout,
  undo restores references/provenance and redo removes them again without
  changing explicit paint. Preserve immutable earlier states.
- Both TikZ modes omit the cleared point's external style invocation and retain
  its explicit paint. Assert the target node, not global disappearance of source
  metadata or keys that another object may legitimately use.

### 2. Retain ordered uncertainty for recognizable unsupported mutations

Represent an explicit unresolved definition state when a recognizable unsupported
declaration mutates an imported style key. At minimum, retain the demonstrated
`.append style` invalidation without evaluating its body as supported semantics.
Apply the same conservative rule to other recognizable unsupported mutations of
a literal target; implementing arbitrary handlers is unnecessary.

Replay supported definitions and targeted invalidations in declaration and
source order, using existing canonical-key and declaration-level `.cd` rules.
A later full supported definition may restore known resolution; an earlier
definition must not erase a later mutation. A final set of successful definitions
plus an unordered warning list is insufficient.

Carry uncertainty and its diagnostic through the shared resolution context,
direct invocation, nested references, preset construction, importer-owned
snapshot refresh, reconstruction from saved sources and both TikZ modes.
Do not resurrect invalidated options via the saved-reference fallback.
Simply deleting a definition or setting `options` to undefined is not enough:
the current resolver treats missing options as an empty, successfully resolved
body, and fallback references can restore the stale definition.

When the handler's effects are unknown, conservatively mark the affected
style's paint unresolved. Scope this to the canonical target and its dependents;
unrelated styles must remain resolved. Later supported options may resolve
their own fields. Preserve explicit local edits, including edits that return
to a fallback value, without claiming unrelated fields.

Retain a deterministic preview fallback and a visible diagnostic. The preview
may show the last known red as an approximation; do not require a blue preview
while deliberately leaving append semantics unsupported. Untouched unresolved
paint must not be emitted as an overriding value after the external key.
Keep defaults before the key and supported/literal or explicit local overrides
after it according to the existing contract.

Preserve raw source/options and stable reference identity. Track defining,
mutating and required dependency sources in deterministic load order, retaining
comment-only load hints. A mutation in a later successfully imported source
must not disappear because it has no new reference for the mutated key.
For cross-file tests, that later file may also contain an unrelated supported
style; adding new mutation-only-file import UI semantics is not required.

### 3. Regress the uncertainty boundary without broadening TeX support

Register tests for:

- The exact red-definition/blue-append example in one block and across separate
  `\tikzset` blocks. Assert import/reference diagnostics, unresolved paint and
  absence of untouched post-key fill/text overrides in both modes.
- A later imported source mutating an earlier definition, ordered dependency
  hints, saved-source reconstruction and save/reload/history.
- Canonical aliases, declaration `.cd`, and a distinct `/other/myPoint`.
- Full definition → mutation remaining unresolved, and full definition →
  mutation → full definition restoring known values in the correct order.
- Nested invocation of an invalidated style followed by a known `text=green`:
  only the later resolved fields regain certainty; unrelated styles stay known.
- Apply before and after a later mutation, preserve local paint edits, and edit
  away/back to the fallback without accidentally overriding untouched text.
- A recognizable unsupported mutation other than the exact append spelling,
  and rejection of stale-reference fallback as a source of false certainty.

Assertions must examine the target node after its actual external key and
resolve generated named colors. Finding red/blue anywhere in the document does
not prove effective paint. Expected results must not be computed by the same
resolver under test.

Retain the compiled failing PGF reference and obtain a focused comparison with
corrected generated output to establish preservation of the external effect.
Keep source, command, PGF version, actual compilation output and observations.
Do not regenerate unrelated opacity/namespace/import-order references or claim
that a TypeScript-only expectation is independent PGF evidence.

## Native acceptance and policy

Extend production browser coverage for both findings using native App events.

For clear, use the actual **TikZ style selector** → **Clear TikZ style** control
for a single point and compatible multiple points. Record model validity,
absence of references and provenance, unchanged explicit paint/preview, target
TikZ output in both modes, real JSON save/reopen, native undo/redo and an
unselected control point. Retain actual SVG export/reopen coverage of preserved
paint, rather than relying only on model inspection.

For unsupported mutations, import/apply the supplied source, verify visible
diagnostics and the documented fallback, inspect both TikZ modes, then exercise
a local override, persistence and history. Preserve the external invocation and
raw source; no renderer support for arbitrary handlers is required.

Keep mandatory coverage of the prior three scenarios:
`point-paint-local-override-intent`, `point-paint-cross-file-resolution`, and
`point-paint-unsupported-color-bindings`.

The current `validateImportedPaintEvidence()` requires an active imported
reference at each existing checked boundary. Clear acceptance needs explicit
detached-state checks requiring BOTH reference and provenance to be absent;
do not weaken the existing imported-state checks to accommodate it.

Make the two new regressions mandatory through added scenarios or explicit
extensions with required observations/artifacts. Preserve the baseline of
16 groups / 23 point scenarios, and update counts and fail-closed policy tests
if scenarios grow. Old successful evidence lacking the new checks must not pass.
Keep fresh-process dependency copying in runner fixtures if helper imports change.

## Preserve completed behavior

Keep saved format compatibility, validated/cloned `importedPaint` intent,
numeric focus/blur no-op behavior, late-import refresh without lost local edits,
canonical runtime namespaces and source-order dependency hints.

Preserve unsupported color shadowing and mixtures, independent paint, single
dimming multiplication, legacy normalization, MathJax color inheritance, shared
body/layout/picking and immutable click-time SVG capture.

Retain responsive geometric borders, framing, saved-body/leaf-font checks,
0.5 → 2 → 0.5 captures, strict same-capture consistency, all three native body
controls, validated white-background metadata, all six responsive downloads
and their current 91 required artifacts. Do not weaken existing acceptance,
fingerprint, review or commit/push gates.

## Verification and completion criteria

Run focused registered action/history/import/export regressions, the full suite,
build, applicable strict production/fixture/test TypeScript checks, changed-script
syntax, targeted lint and `git diff --check`. Run `npm test` and `npm run build`
sequentially because they share asset preparation. Report established lint
debt and the nonblocking chunk-size warning separately.

Obtain fresh browser-capable parent verification for the final checkout:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands, both browser checks, cumulative groups/scenarios and
new defect-specific evidence to pass with empty page errors and matching final
identity, including untracked tests/helpers and PGF binaries. The accepted
`4OOIEu` run remains valid evidence for its pre-fix checkout; it does not cover
these corrections.

After fresh verification, independently review the same tree against
`prompts/phase-32b-review.md` and explicitly recheck both findings. Review already
ran and requested changes; `32B verify` itself does not review. Phase 32B remains
incomplete until the defects are fixed and both gates pass. Keep 32C/32D deferred.

## Report

Update `docs/PHASE_32B_IMPLEMENTATION.md` and relevant data-model/import notes
with the detached-provenance cause and cleanup, ordered unsupported-mutation
uncertainty, focused/native/PGF regressions, exact commands/results and final
checkout identity. Distinguish accepted pre-fix browser evidence from new
acceptance, and document unsupported preview behavior without claiming handler
execution.
