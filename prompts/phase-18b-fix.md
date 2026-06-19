# Phase 18B Fix Prompt: Sanitize embedded label newlines in inline math TikZ output

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Also run if available:

```bash
git diff --check
```

## Context

You are working on the StratifiedTikZ project.

Phase 18B implemented inline math TikZ output.

A previous fix removed blank lines introduced by generator section helpers and line arrays.

Review result after that fix:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Inline math output can still contain blank lines when raw label text contains embedded blank lines.

Current behavior:

- `emitLabel` interpolates `label.text` directly into a single TikZ string.
- `joinInlineMathTikzLines` only filters blank entries in the generated line array.
- If `label.text` itself contains embedded newlines, those newlines become actual lines in the final output.
- A label such as:

```text
A

B
```

or the string:

```ts
"A\n\nB"
```

can produce an actual blank line inside:

```tex
\node ... {A

B};
```

This violates the inline math no-blank-lines requirement and can break use inside `align`.

The UI permits such label text through the label textarea, and validation does not currently constrain label text. The fix should handle this at TikZ export time.

## Goal

Fix inline math blank-line handling for embedded newlines in raw label text.

Inline math export must not contain any blank line, including blank lines that originate inside label text.

Requirements:

- `exportMode: "inlineMath"` emits no blank lines anywhere.
- Label text is preserved as much as practical.
- Standalone output behavior should remain unchanged unless there is an existing bug.
- Add a regression test with a free text label containing:

```ts
"A\n\nB"
```

## Scope

This is a targeted Phase 18B fix.

Implement:

- inline-safe label text formatting/sanitization for TikZ export;
- tests for label text with embedded blank lines;
- final no-blank-lines regression coverage if needed.

Do not implement:

- new label editor UI;
- new validation constraints on label text;
- full LaTeX text parser;
- broad TikZ generator rewrite;
- new export modes;
- new dependencies.

Do not change:

- diagram data model;
- saved label text;
- standalone output semantics unless explicitly justified;
- SVG preview behavior;
- label editing UI behavior;
- style/layer/camera/work-plane behavior.

## 1. Inspect label export

Inspect:

- `src/tikz/generateTikz.ts`;
- `emitLabel`;
- any helper that formats raw label text;
- `joinInlineMathTikzLines`;
- tests for label export;
- tests for inline math output no-blank-lines.

Find where `label.text` is interpolated into TikZ output.

Current problematic pattern is conceptually:

```ts
`\\node[...] at (...) {${label.text}};`
```

If `label.text` contains `\n\n`, the final output contains a blank line even if the line array has no blank entries.

## 2. Add inline-safe label text formatting

Add a helper such as:

```ts
formatLabelTextForTikz(labelText: string, options: { exportMode: TikzExportMode }): string
```

or:

```ts
formatInlineMathLabelText(labelText: string): string
```

Exact name can differ.

For `exportMode: "inlineMath"`, the helper must ensure the returned string does not contain a blank line.

Acceptable behavior:

### Preferred

Replace line breaks in label text with a LaTeX-safe inline separator that preserves visual intent reasonably.

For example:

```text
A\nB     -> A\\ B
A\n\nB   -> A\\ B
```

or:

```text
A\nB     -> A \\\\ B
A\n\nB   -> A \\\\ B
```

Choose the safest convention for TikZ node text in this project.

### Also acceptable

Collapse all whitespace/newline runs to a single space in inline math mode:

```text
A\n\nB -> A B
```

This is less faithful but align-safe and simple.

### Not acceptable

Leaving actual newline characters in inline label text when they can create blank lines.

If preserving line breaks with `\\` is implemented, ensure the produced TikZ remains valid inside node text.

## 3. Preserve standalone behavior

Standalone output may continue to preserve raw label newlines if that was the previous behavior.

Preferred:

- Only sanitize embedded newlines for `inlineMath`.
- Leave standalone label text unchanged.

If a shared helper is introduced, make mode-specific behavior explicit.

## 4. Preserve diagram data and SVG preview

Do not modify stored `label.text`.

The export formatter should be output-only.

Requirements:

- user-entered label text remains unchanged in diagram data;
- save/load preserves label text;
- SVG preview remains unchanged unless it already normalizes display;
- inspector textarea behavior remains unchanged.

## 5. Final inline no-blank-lines guard

The earlier inline formatter removes blank entries from generated line arrays, but this issue proves blank lines can appear inside a single generated string.

Add or update a final inline output assertion/sanitizer if appropriate.

Options:

### Option A: Ensure all emitters produce inline-safe strings

- Sanitize label text.
- Keep final joiner as-is.

### Option B: Add final check in tests only

- Tests assert no blank lines in final output.
- Production generator does not silently rewrite arbitrary content except known label text.

### Option C: Add final production sanitizer

- Replace blank lines in final inline output.
- Be careful not to corrupt TikZ commands.

Preferred:

- sanitize known free-text fields such as labels;
- keep final no-blank-lines test coverage.

Do not use a blind final regex that might corrupt meaningful TikZ content unless carefully justified.

## 6. Consider other free-text fields

Review whether other user-entered raw text fields can contain embedded blank lines and appear inside generated TikZ.

Potential examples:

- free text labels;
- comments;
- raw TikZ snippets if any;
- imported style comments if user-controlled;
- path labels if they are emitted as raw text.

This fix must handle free text labels at minimum.

If other fields can create blank lines in inline output, either:

- sanitize them too; or
- add a TODO/report limitation.

Do not let this become a broad raw-TikZ parser task.

## 7. Tests

Add focused tests.

Required tests:

1. Inline export with free text label `"A\n\nB"` contains no blank lines.

Use assertion:

```ts
expect(output.split("\n").some((line) => /^\s*$/.test(line))).toBe(false);
```

2. Inline export with label `"A\n\nB"` still contains both `A` and `B`.

3. Inline export with label `"A\nB"` contains no blank lines.

4. Inline export with label containing leading/trailing blank lines, for example:

```ts
"\nA\n\nB\n"
```

contains no blank lines and remains valid.

5. Standalone output behavior for multiline labels is preserved or intentionally updated and documented.

6. Existing inline no-blank-lines tests for representative 2D/3D output still pass.

7. Save/load or model data tests confirm label text is not mutated by export, if such tests are easy.

## 8. TikZ validity expectations

If the helper converts newlines to `\\` or `\\ `, add a test that generated node command remains syntactically plausible.

For example, output should look like one line:

```tex
\node[...] at (...) {A\\ B};
```

or:

```tex
\node[...] at (...) {A B};
```

depending on chosen policy.

It should not emit:

```tex
\node[...] at (...) {A

B};
```

## 9. Documentation/comments

Add a short comment near the label text formatting helper:

- inline math export cannot contain blank lines;
- raw label newlines are normalized only for export;
- stored label text is unchanged.

Update user docs only if necessary.

## 10. Preserve existing behavior

Do not regress:

- inline baseline option;
- inline setup placement;
- inline no-blank-lines behavior from section helpers;
- imported style comments;
- local user styles;
- layer-aware output;
- camera output;
- standalone output;
- SVG preview;
- label editing;
- save/load;
- all geometry export.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Then:

1. Create or select a free text label.
2. Set label text to:

```text
A

B
```

3. Switch TikZ export mode to Inline math.
4. Confirm generated TikZ contains no blank lines.
5. Confirm both `A` and `B` are still present in the node text.
6. Confirm the output still starts with:

```tex
\begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}]
```

7. Switch to Standalone mode.
8. Confirm standalone output remains acceptable.
9. Copy the inline output and paste into an `align` environment if practical.

## 12. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 13. Report after implementation

Please report:

- files modified;
- root cause of embedded label blank lines;
- chosen newline-normalization policy;
- whether standalone label output changed;
- how stored label text remains unchanged;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
