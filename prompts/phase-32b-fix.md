# Phase 32B Targeted Fix Prompt: Preserve local override intent and consistent imported-style resolution

## Environment

Work on the current Phase 32B checkout (reported branch:
`phase/32b-color-opacity-outline`). Inspect status and preserve all current
changes, including the completed white-background, saved-body, font, responsive
capture and verifier corrections. Do not reset or restart implementation.

The accepted parent and independent review checked revision
`5ff8289bb15cdec412469269947c659a63408c31` plus working-tree changes, with
the unchanged fingerprint:

```text
4061512fdc4f58a9d71ec92378920a24dbe8c22406beba9c222aa232c0011742
```

This matches the inspected checkout before this prompt update. New implementation
requires fresh matching final-tree evidence.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Fix the three demonstrated Phase 32B import/override defects below. Preserve
32A behavior and defer 32C/32D. Keep strict TypeScript, bounded literal parsing,
human-readable TikZ, explicit styles and raw source preservation. Avoid new
dependencies and unrelated cleanup. A small persistent representation of user
override intent is in scope; document and test its compatibility.

## Accepted verification and remaining review findings

Verification passed. Independent review ran and accepted the required browser
and PGF evidence, but found three Medium production defects. This is no longer
a browser-startup, screenshot, text-metric or white-background acceptance gap.

Read the review and its production-function reproductions:

```text
/Users/takamatoshinori/.codex/attachments/cb8fb36b-f1c1-4e0b-b981-c5240a5248ab/pasted-text.txt
/private/tmp/stz-32b-review-reproductions.log
```

Accepted parent evidence:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-xgI0o0/verification.json
```

Inspect the actual reports and artifacts under its
`04-check-label-assets` and `05-check-free-labels` directories.

| Observation | Accepted result |
| --- | --- |
| Full suite | 3,006 passed; zero failures/skips |
| Build / diff / both browser checks | Passed |
| Browser | Chrome 154.0.8037.57 |
| Node | v26.9.0 |
| Free-label groups / point scenarios | All 16 / all 20 |
| Browser evidence records / page errors | 164 / none |
| Required independent PGF evidence | Present and accepted |
| Independent review | needs changes; 0 Critical, 3 Medium, 0 Low |
| Commit readiness | No, due to the production defects below |

Strict production/fixture/focused paint TypeScript and all 24 changed JavaScript
syntax/lint checks passed. Of 31 changed TypeScript files, 30 lint cleanly; the
remaining 25 no-regex-spaces errors were reproduced at the pre-32B baseline.
Preserve that distinction instead of expanding this task into lint cleanup.

### 1. Explicit edits returning to a fallback value lose their TikZ override

Import and apply:

```tex
\tikzstyle{example}=[fill=\mycolor,text=red]
```

Change Fill color to `#123456`, then back to `#000000`.
Preview/SVG retain black, but both TikZ modes omit the post-`example` fill
override and restore the external macro's color. Save/reload preserves the bug.

`pointImportedStyleOverrideOptions()` in `src/tikz/generateTikz.ts`
compares current paint with the fallback baseline, then suppresses equal fields
if external resolution is unknown. Equality cannot distinguish an untouched
fallback from a deliberate local edit that returns to that value. Existing
tests exercise an edit away from the fallback, but not the return edit.

### 2. Previously imported definitions have inconsistent resolution scope

Import `base.sty`, then `outer.sty`:

```tex
% base.sty
\tikzset{base/.style={fill=red,text=green}}
% outer.sty
\tikzset{outer/.style={base,draw=blue}}
```

Applying the outer point preset currently produces black fill/text and blue
stroke, with an unsupported-base diagnostic. Import diagnostics and preset
construction use only the current import's definitions. Export resolves against
all diagram references, then writes those stale black fallback values after
`outer`, overriding the intended red/green.

Export usage tracking also registers only the directly selected source.
Dependency load hints must include the known defining sources needed to make
the emitted external keys mean what preview resolution assumed.

### 3. Unsupported color redefinitions expose stale or built-in values

Import:

```tex
\definecolor{red}{cmyk}{1,0,0,0}
\tikzstyle{myPoint}=[fill=red,text=red]
```

The parser warns that CMYK is unsupported but retains successful built-in-red
resolution. Both TikZ modes emit red fill/text after `myPoint`, replacing the
external cyan definition.

`parseTikzsetStyles()` only stores supported literal definitions.
`literalTikzColor()` falls back to built-in colors when a name is absent.
An unsupported redefinition neither invalidates an earlier parsed value nor
blocks built-in fallback. Merely deleting the old value cannot fix built-in
names such as `red`.

## Required reading

Read `AGENTS.md`, the paired 32B implement/review prompts, and the current
`docs/PHASE_32_PLAN.md` and `docs/PHASE_32B_IMPLEMENTATION.md`. Trace:

- `src/model/importedTikzStyles.ts` and `src/model/importedTikzPaint.ts`;
- imported source/reference, point style and preset types, validation,
  serialization/normalization and cloning;
- `src/model/stylePresets.ts`, `src/ui/diagramUpdates.ts`,
  `src/ui/styleClipboard.ts`, bulk/quick edits and preset application;
- `src/ui/inspector/PointStyleEditor.tsx` and `PointPaintFields.tsx`;
- point imported-style emission, baseline/unresolved-field resolution and
  external-source load comments in `src/tikz/generateTikz.ts`;
- `tests/model/pointPaintImport.test.ts`, existing model/UI/TikZ regressions,
  and `scripts/checkPointNodePaint.mjs` with its fixtures/verifier policy.

Review locations were approximately generateTikz.ts:6928,
importedTikzStyles.ts:450 and :199, and importedTikzPaint.ts:64. Locate current
functions rather than relying on unchanged line numbers.

## Required correction

### 1. Persist explicit local paint intent independently of fallback equality

Introduce a small typed representation of which paint settings were explicitly
overridden relative to the active imported style, or an equivalent design that
preserves the same distinction. Record accepted user edits at the model update
boundary and carry that intent through export. Do not try to reconstruct it
solely from current-value equality at export time.

An untouched unresolved external property must retain its external meaning;
a local edit must remain authoritative even when its value equals the original
preview fallback. Emit the effective local override after the external style
key in both standalone and inlineMath output. Do not solve this by always
overriding every unresolved property, dropping the external reference, or adding
a dummy numeric/color difference.

Keep intent at the property level: editing fill must not accidentally claim
unknown text or border settings. Account for coupled controls that intentionally
edit multiple channels, paint enablement, opacity, width and dash settings.
Preserve existing effective-opacity/dimming behavior.

Treat this as authoritative editing state, not a React cache or renderer flag.
Support serialization/reload, validation, deep cloning, duplicate/copy/paste,
history and relevant preset/bulk/quick-edit paths. Define what reapplying or
replacing an imported preset does to its local overrides, and prevent intent
from leaking to an unrelated imported reference. No new reset UI is required
if existing preset actions provide the intended reset behavior.

Keep old diagrams and presets readable. Define deterministic handling of absent
intent metadata and preserve existing explicit values; do not turn every legacy
fallback into an override or silently drop distinguishable legacy edits.
Document the unavoidable ambiguity of historical equal-valued edits rather
than claiming to reconstruct information old files never stored. Any format
change must have explicit validation, migration and round-trip tests.

### 2. Use one coherent ordered context for imports, diagnostics and export

Resolve known styles and colors from the applicable imported sources using a
shared deterministic context. The second import in the reproduction must see
the first import when creating presets and diagnostics. Baseline reconstruction,
unresolved-field analysis and both TikZ modes must use compatible scope and
ordering. Do not fix the discrepancy by making export ignore known definitions.

The two-file example must yield red fill, green text and blue stroke in the
applied point and SVG, without a false unsupported-base warning. Preserve the
exact external key and source/reference IDs, raw source/options and stable
save/reload behavior. Test named colors supplied by prior files as well as
style references. A prior file containing both color and style declarations
suffices; adding color-only import UI/result semantics is not required here.

Specify and test later-import, duplicate/redefined-key and missing-dependency
behavior. In the ordered resolution context, later applicable canonical
definitions win for the directly invoked key as well as nested references;
an older reference ID must not silently select a stale root body. A definition
becoming known later must not turn an earlier unresolved fallback into an
intentional local override. Distinguish importer-produced preview/fallback
snapshots from user-authored values. Preserve actual user edits and explicit
saved styles; do not blindly regenerate all existing presets or overwrite
already edited points when another file is imported.

Retain canonical alias semantics: `base` and `/tikz/base` share identity;
`/other/base` is distinct. Nested style bodies use the invocation's runtime
directory, not a declaration-parent fallback. Keep ordered options, bounded
expansion, cycle diagnostics and explicitly unsupported runtime directory changes.

Track the known style/color source dependencies used by resolution and include
their load hints in deterministic order consistent with that resolution.
Selecting only `outer` must include both `base.sty` and `outer.sty` hints.
Deduplicate without silently changing redefinition precedence or depending on
diagram-element traversal order. Keep hints as comments, preserve custom hints,
and do not execute files or embed arbitrary raw preambles into generated TikZ.
Unknown external dependencies remain explicitly unresolved.

### 3. Represent unsupported color definitions as unknown bindings

Distinguish an undeclared name, a supported literal definition and a recognized
but unsupported definition. An unsupported redefinition must invalidate earlier
resolution of that name and prevent fallback to a built-in with the same name.
Carry this state consistently through the shared import context, preset/baseline
construction, diagnostics, save/reload reconstruction and export.

Respect declaration/source order: supported then unsupported becomes unresolved;
unsupported then supported may resolve to the later literal value. Style bodies
use the effective color environment when invoked after the applicable sources
load, not a snapshot at the style declaration's textual position. Keep names
case-sensitive and state local to the diagram's ordered import context; do not
mutate the global built-in color table or make unrelated colors unknown.

Propagate unresolved color use to the affected paint fields and mixtures,
including either explicit mixture operand or an implicitly used white operand.
Retain a deterministic preview fallback with a clear diagnostic, but do not
present stale built-in/previous colors as successfully resolved.

For an untouched unresolved fill/text, preserve the external effect after
`myPoint` by omitting inappropriate post-key overrides. A later supported
option or deliberate local edit may override its affected fields, including
a local edit back to the fallback value addressed in correction 1. Keep known
unrelated channels intact. Do not add CMYK support, execute TeX or expand the
supported grammar merely to special-case this reproduction.

## Regression and native acceptance requirements

Register meaningful production-path tests covering:

- The exact macro-fill edit sequence, then save/reload and undo/redo. Both modes
  must preserve the final local black override after the external key. Untouched
  unknown fill must still retain its external meaning. Include representative
  non-color paint edits that return to their fallback values and channel isolation.
- Sequential imports of the two files, prior-file color definitions, application
  of the outer preset, accurate diagnostics, dependency hints and both-mode output.
  Include truly missing dependencies, canonical aliases/redefinitions (including
  the directly invoked key), later imports and preservation of local edits
  through save/reload/history.
- The exact unsupported built-in-red redefinition; supported-custom/built-in then
  unsupported; reversed order restoring a supported value; affected mixtures;
  later known paint options and explicit local overrides. Check that unrelated
  colors remain resolved.
- Required clone/clipboard/preset/normalization paths for any new persisted
  intent, including absent or invalid metadata and reference replacement.

Inspect options after the actual external key and resolve generated named color
definitions when testing effective output. Finding the expected color somewhere
in a document is insufficient: a prior fallback or unrelated node may contain
it. Expected results must be independent of the resolver under test.

Extend the production browser harness using native import, preset and Inspector
events. Demonstrate the edit-away/edit-back sequence, cross-file application,
unsupported-color diagnostics, save/reload and history behavior, preview paint,
both generated TikZ modes and actual SVG output. Preserve the existing real
MathJax/lifecycle/picking and immutable export tests. Record observations before
assertions and retain bounded capture/error cleanup.

Make coverage of the three review reproductions mandatory in the parent policy,
either as explicit extensions of existing scenarios or additional named scenarios
with required artifacts. An old successful 20-scenario report must not satisfy
the new requirements without their evidence. Keep the existing 16 groups and
20 scenarios as the baseline; update counts and policy tests if scenarios grow.

Retain accepted PGF references. Use focused independent PGF cases where needed
to establish disputed source/load-order or override semantics, preserving source,
commands and actual results. Do not regenerate unrelated reference artifacts or
use a TypeScript parser's output as independent PGF proof.

## Preserve completed behavior and verification gates

Preserve the accepted namespace corrections, independent paint and single
dimming multiplication, responsive geometric borders, shared body/layout/picking,
and immutable click-time SVG capture. Retain legacy node/preset normalization,
black text, white hollow fill, 0.4pt border, regular-polygon identities and spacing.

Keep the saved-body/leaf-font contract, 0.5 → 2 → 0.5 captures, framing, strict
same-capture consistency, all three native body controls and the validated
white-background marker exception. Preserve all six responsive downloads and
their current 91 required artifacts, plus any newly required evidence. These
accepted harness corrections are not the target of this follow-up.

Do not weaken fresh-process verification, checkout fingerprints, required
artifacts, independent review or commit/push gates.

## Verification and completion criteria

Run focused registered model/import/export/UI/history regressions, the full
suite, build, applicable strict TypeScript/fixture checks, changed-script syntax,
targeted lint and `git diff --check`. Run `npm test` and `npm run build`
sequentially because they share asset preparation. Report established lint
debt and the nonblocking chunk-size warning separately.

Obtain fresh browser-capable parent verification of the final checkout:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands, both browser checks, all cumulative groups/scenarios
and the new defect-specific evidence to pass, with empty page-error arrays and
matching final-tree identity. The accepted `xgI0o0` run remains valid historical
evidence for its unchanged checkout; it does not cover these new fixes.

After fresh verification, independently review the same tree against
`prompts/phase-32b-review.md` and explicitly recheck all three findings.
The review already ran once and requested changes; do not describe it as never
performed. `32B verify` itself does not review. Phase 32B is incomplete until
the three defects are fixed and both acceptance gates pass; 32C/32D remain deferred.

## Report

Update `docs/PHASE_32B_IMPLEMENTATION.md` and relevant model/import/export notes
with the three root causes, chosen intent/persistence semantics, consistent
scope/dependency ordering, unsupported-color invalidation, registered/native
regressions, exact commands/results and final checkout identity. Distinguish
the accepted pre-fix verification from the new implementation's acceptance.
Report any legacy-file intent ambiguity or unsupported external behavior
accurately rather than claiming full TeX evaluation.
