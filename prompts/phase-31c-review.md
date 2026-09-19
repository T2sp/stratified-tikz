# Phase 31C Review Prompt: Free-label SVG rendering, measured placement, and picking

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

Require completed 31A/31B. Read `prompts/phase-31c-implement.md`, the actual
shared parser/adapter, production free-label rendering, runtime state,
layout/picking helpers and their consumers, and relevant tests.

This review includes free labels and their interaction behavior. Inline-node
conversion belongs to 31D and settled-export waiting belongs to 31E.

## Review checklist

Check:

- The actual free-label path invokes the shared adapter and uses a proper
  component/controller with no asynchronous mutation during React rendering.
- Text/math runs and physical lines share consistent baselines and finite bounds.
- All nine anchors use actual dimensions and the established font scale.
- Drawn content and free-label picking use the same current layout result;
  successful formulas are not picked using source character count.
- Pending/failure state shows the full latest source, with literal whitespace,
  line breaks, delimiters, and markup-looking characters preserved.
- Valid-invalid-valid edits cannot leave a last-good formula on the canvas.
- Generation checks handle completion inversion, deletion, unmount, document
  replacement with reused IDs, and font/style changes.
- Immutable cached geometry is reused safely across duplicate labels.
- Camera/position/selection-only changes do not trigger new conversions.
- Color/currentColor and opacity work for text, paths, fractions, and fallback.
- Outer selection groups, click/cycling priority, dragging, layer locks and
  filters, and autoHide/autoDim remain correct.
- Coordinate/axis/handle text and undisplayed metadata are not newly typeset.
- Results/bounds do not leak into model JSON, undo history, or TikZ output.
- Current SVG cloning remains safe with both settled and pending labels.
- Tests include the production component/event paths and browser evidence.

## Focused verification

Exercise a tall fraction and a short formula whose raw source is much longer
than its display. Test center/north/east anchors and pointer positions just
inside/outside the measured bounds; then repeat after pan/zoom and in 3D.

Inject delayed adapter results for two successive edits and verify final visible
source, bounds, and selection agree with the newer request. Repeat with a
load/new-diagram action reusing the same label ID. Check layer locking and
autoHide while conversion is pending.

Verify the raw source remains in the editor and JSON, and that normal input
editing follows existing Undo/Redo while result arrival adds no history entry.
Report browser checks honestly; passing pure helpers alone does not establish
SVG positioning or click correctness.

## Severity guidance

Critical issues include input execution, saved-source loss, or corrupted
diagram/history state caused by asynchronous rendering.

Medium issues include stale formula/fallback display, wrong whole-label
fallback, inaccurate compiled-label picking, broken anchors/visibility/color,
unbounded pending state, repeated recompilation on camera moves, failed
current SVG export, or missing production/browser verification for core paths.

Do not require 31D inline labels or 31E settled export in this review.
