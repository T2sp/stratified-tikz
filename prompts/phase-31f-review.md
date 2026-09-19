# Phase 31F Review Prompt: Combined TeX-label regression coverage and completion audit

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Run repository-wide lint only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Report existing lint debt separately; do not turn this subphase into unrelated
cleanup. Run any additional focused checks required below. Never report an
unavailable check as passed.

## Project context

You are working on StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

This prompt series was prepared from public `main` at commit
`1a49d02a7ade18ecf08c4b4f1e22414e740970bb`, following Phase 30.
Inspect the current checkout before making changes; named files are starting
points, not an exhaustive change list. Preserve later compatible work.

Phase 31 consists of these ordered subphases:

| Subphase | Responsibility |
| --- | --- |
| 31A | Label input grammar and exact-source fallback contract |
| 31B | MathJax-to-SVG adapter, metrics, isolated conversion, and cache |
| 31C | Free-label rendering, asynchronous lifecycle, placement, and picking |
| 31D | Path inline-node labels through the shared renderer |
| 31E | Settled-label SVG export and standalone SVG fidelity |
| 31F | Combined regression coverage, documentation, and completion audit |

Implement or review only the subphase named in this file. Later subphases are
not acceptance requirements for earlier ones. Every subphase must leave the
existing application usable and its own verification passing.

Preserve these project conventions and existing behaviors:

- strict TypeScript; avoid `any`;
- an n-stratum means codimension n, not geometric dimension;
- separate model, geometry, rendering, TikZ generation, and UI;
- small, testable helpers and behavior-level tests;
- the SVG Preview editing canvas, 2D/3D projection, pan, zoom, and work planes;
- layer filtering, visibility, locking, selection, and existing edit gestures;
- coordinate anchors/references and symbolic coordinates;
- save/load, existing history semantics, and Undo/Redo;
- human-readable TikZ, 4-space indentation, and blank-line-free inline-math output;
- transparent/white SVG export and removal of editor-only overlays.

## Phase 31 shared contract

Only user-authored visible diagram labels are typeset: free `TextLabel.text`
and path inline-node `text`. Coordinate names, axes, handles, toolbar copy,
and saved-path `pathLabel` identifiers are not TeX labels for this feature.
Do not add new visual uses of previously undisplayed stratum label metadata.

Keep the original input authoritative in the model and editor. Do not add
math delimiters, trim the saved string, change the JSON schema, or rewrite
TikZ source. Existing TikZ export-mode formatting remains unchanged. Generated
SVG, parsed runs, errors, metrics, caches, and pending requests are derived
runtime state and must never enter `Diagram` or undo history.

The bounded preview language supports ordinary Unicode text mixed with
`$...$`, `\(...\)`, `$$...$$`, and `\[...\]` math runs. The exact scanner and
escaped-literal rules are defined in Phase 31A. MathJax is a math typesetter,
not a full LaTeX engine. Arbitrary packages, document preambles, external
style-file macros, and unsupported text-mode commands are outside this phase;
an unsupported label falls back to its complete original source.

For an invalid delimiter, unsupported construct, undefined math command,
TeX parse error, output error, resource failure, or bounded-work failure:

```text
failed label -> latest original input, displayed literally in full
```

Never show an error SVG, a replacement message, a partly typeset label, or a
previous successful formula in place of a failed current label. Preserve
delimiters, backslashes, leading/trailing/repeated spaces, tabs, and physical
newlines in literal fallback. Insert original input as text, never HTML.
The failure of one label must not suppress other labels or diagram geometry.
Pending labels also show their latest source until their own result is ready.

Successful output uses SVG geometry plus ordinary SVG text for text runs;
avoid `foreignObject` and rasterized formulas. Keep geometry self-contained,
colors explicit, and dimensions finite. MathJax-generated markup is not a
license to insert arbitrary user HTML or SVG.

Each label's rendering, bounds, and picking must describe the same input
revision. No stale completion may resurrect a deleted label or overwrite a
newer input, document, selection, or style state. Moving the camera or label
must not recompile unchanged TeX.

## Review instructions

Review this subphase only, against its paired implementation prompt and the
shared contract above. Check the actual production paths and the tests that
exercise them. Do not require deferred subphases to be implemented early.

Do not modify files.

Run the required verification in Environment and the focused checks below.
Report actual command results and distinguish observed behavior from code
inspection. If a browser check is unavailable, state that explicitly.

At the end, output:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and
   `REVIEW_JSON_END`.

Use:

```markdown
**Summary:** pass / needs changes

**Critical Issues**
- ...

**Medium Issues**
- ...

**Low-Priority Issues**
- ...

**What Looks Correct**
- ...

**Test Results**
...

**Build Results**
...

**Ready To Call This Subphase Complete**
Yes/No, with a short reason.

**Suggested Targeted Follow-Up Prompt**
...
```

Then emit one valid JSON object using the existing keys:

```text
REVIEW_JSON_START
{
  "summary": "pass or needs_changes",
  "critical_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "ready_to_commit": true,
  "suggested_fix_prompt": ""
}
REVIEW_JSON_END
```

Replace the summary placeholder with exactly `pass` or `needs_changes`.
Set `ready_to_commit` to `false` if any Critical or Medium issue remains.
Do not claim readiness when required verification is unavailable or fails
without a demonstrated unrelated baseline explanation. Explain that limitation
and include it in the targeted follow-up.

For every finding, provide a concrete trigger, observed or code-supported
consequence, and file/line reference. Keep speculative improvements separate
from acceptance failures. Do not repeat the implementation report as evidence.

## Scope and prerequisites

Review Phase 31F against `prompts/phase-31f-implement.md` and the integrated
31A-31E contracts. This is the final combined audit, so earlier deferred features
are now required. Do not introduce new syntax, engines, or unrelated UI work.

Read the paired earlier prompts and unresolved review findings. Establish that
the tested code paths are the ones used by the real editor and Export SVG action.

## Combined behavior checklist

- Empty/plain/Unicode labels preserve their defined behavior.
- All supported delimiter forms and mixed text/math run sequences are covered.
- Invalid delimiters, TeX errors, unknown/unsupported commands, resource errors,
  and bounded-work failures produce the whole original source literally.
- Fallback preserves delimiters, backslashes, repeated spaces, tabs, physical
  newlines, and markup-like input, without unsafe HTML interpretation.
- Failed labels do not suppress unrelated labels or geometry.
- Rapid edits and success→failure→success transitions use the latest revision.
- Out-of-order requests, delete/load/unmount, and Undo/Redo cannot restore stale
  output or stale picking bounds.
- Repeated formulas share safe conversion/cache work without leaking per-label
  styles, lifecycle, identifiers, or macro state.
- Transient resource failures recover on retry and all work is bounded.
- Camera/position changes do not recompile unchanged TeX unnecessarily.
- Free labels support all nine anchors with corresponding measured picking.
- Path text preserves five placements, white outline, pointer-event pass-through,
  and existing Alt-click inline-node marker selection.
- 2D/3D projection, visibility, layer filtering, locking, opacity, and scale remain
  consistent with current editor behavior.
- Coordinate/UI names and previously undisplayed metadata remain outside scope.

## Export and persistence checklist

- Exports settle free/path labels and serialize actual completed representation.
- Pending exports retain one click-time diagram/view/options revision while live
  edits continue normally.
- Both background modes preserve exclusion rules and standalone visual fidelity.
- Formula glyphs/styles/colors/local references survive outside the application.
- Failed labels retain their literal source in reopened SVG files.
- Duplicate clicks, timeouts, retries, and stale callbacks obey the 31E policy.
- JSON/schema, authoritative strings, and history contain no derived state.
- Actual standalone/inline TikZ output is unchanged for identical diagrams;
  four-space indentation and blank-line-free inline output still hold.

## Test quality and evidence

Confirm that the acceptance matrix maps to actual fixtures/tests. Require useful
combined workflows rather than duplicate unit coverage or a full Cartesian set.

Check runtime evidence for real adapter conversion and failure, deferred races,
view changes, selection/picking, cache isolation, snapshot export, and persistence.
Source grep alone is not proof; exclusively mocked conversion cannot establish
MathJax behavior. Confirm new test files run through `package.json`.

Run the full required verification and focused checks. Report actual results,
including test totals, failures, skips, and demonstrably unrelated baseline issues.

Inspect real-browser evidence for tall/mixed/Unicode formulas, the anchor/path
placement cases, selection behavior, 2D/3D visibility, and pending/error changes.
Require downloaded SVGs reopened outside the app for both backgrounds and mixed
successful/failed labels. State clearly if any required evidence is unavailable.

## Documentation and completion

Check `docs/PREVIEW_UI.md`, `docs/SPEC.md`, and `docs/ROADMAP.md` against actual
behavior and chosen configuration/limits. Examples must preserve TeX backslashes
and show full-source fallback. No document may promise arbitrary LaTeX packages,
external preambles/macros, or unsupported offline/full-engine compatibility.

The roadmap must not mark Phase 31 complete while required runtime/browser/export
checks are missing or acceptance defects remain. Require a concrete follow-up
for unavailable verification; do not convert it silently into an optional check.

## Issue classification

Critical issues include unsafe source execution or authoritative data/history
corruption. Medium issues include any violated A-E contract, missing combined
coverage for a documented race, unregistered tests, documentation promising
unsupported behavior, or an unresolved required acceptance/verification gate.

Low-priority issues are nonblocking presentation or documentation polish. In the
final review, separate verified behavior, observed failures, and unavailable
checks before determining whether this subphase and Phase 31 are complete.
