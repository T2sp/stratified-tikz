# Phase 31A Review Prompt: Label input grammar and exact-source fallback contract

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

## Prerequisites and required reading

Read `prompts/phase-31a-implement.md`, `AGENTS.md`, the new parser and its
tests, the raw-label model/TikZ contracts, and the current test script.
This review covers parser foundation and documentation only. MathJax,
production rendering, measured picking, and export waiting are deferred.

## Review checklist

Check:

- Only the visible user-authored label contract is introduced; the model and
  stored source remain authoritative and unchanged.
- The parser is pure, bounded, strictly typed, and independent of React/DOM.
- Inline/display delimiters and escaped literal characters follow the paired
  prompt, including deterministic dollar precedence and nested braces.
- Display-style math does not silently become another label or paragraph.
- Ordinary text newlines form visual label lines, while newlines inside math
  remain in that math run for MathJax; literal fallback preserves all line breaks.
- A missing or unsupported construct returns the whole original string,
  including already parsed prefixes, whitespace, newlines, and backslashes.
- Unsupported text commands do not get passed through as trusted HTML.
- Unknown math commands are delegated to 31B, not claimed valid by the parser.
- Source offsets agree with actual JavaScript slices for Unicode fixtures.
- Input/run limits are named and documented; source is never truncated.
- Empty input and literal `<>&` content are safe data.
- JSON, TikZ generation, Inspector inputs, and undo state are unaffected.
- Every new test file is in `npm test`.
- The roadmap distinguishes 31A completion from future 31B–31F work.

## Focused verification

Execute the parser tests directly as well as the Environment checks. Include
counterexamples with mixed valid/invalid runs and escaped delimiters inside
braced math; do not infer correctness from happy-path examples alone.

Inspect serialization and both TikZ export modes before/after parser use with
identical fixtures. Confirm existing production labels still use the original
rendering path at this stage.

## Severity guidance

Critical issues include mutation/loss of stored user input or execution of
input as code/markup.

Medium issues include partial instead of whole-label fallback, lossy source
reconstruction, misparsed supported delimiters, unbounded parsing, missing
behavioral tests/test registration, or an incorrect claim that future stages
are already implemented.

Do not mark absence of a MathJax dependency or typeset UI as a defect in 31A.
