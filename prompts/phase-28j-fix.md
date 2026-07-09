# Phase 28J Fix Prompt: Align docs with Phase 28 style-reference and SVG arrow-preview behavior

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

Also run:

```bash
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not treat lint as a required gate if the repository still has existing broad lint debt.

## Context

You are working on the StratifiedTikZ project.

Phase 28J added docs, tutorial hooks, accessibility labels, and integration tests for the Phase 28 preview-first UI work.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- Two Medium documentation issues remain.
- The issues are documentation contradictions, not implementation failures.

## Medium issue 1: `docs/EDITING.md` contradicts Phase 28 imported-style behavior

Current problem:

`docs/EDITING.md` still says bulk style edits clear:

```text
style preset/import references
```

But Phase 28 behavior is more nuanced:

- explicit shortcut/bulk style edits clear local/user `stylePresetId`;
- imported TikZ style references are preserved when possible;
- explicit field edits become explicit overrides after the imported style reference;
- this avoids losing imported style identity and avoids duplicate TikZ options.

`docs/PREVIEW_UI.md` already documents the newer behavior, so the docs currently contradict each other.

Review location:

```text
docs/EDITING.md
docs/PREVIEW_UI.md
```

## Medium issue 2: `docs/TIKZ_OUTPUT.md` has stale SVG arrow-preview description

Current problem:

`docs/TIKZ_OUTPUT.md` still says the SVG preview draws approximate triangular arrowheads and does not attempt `Stealth`, `Latex`, or harpoon glyphs.

But Phase 28 now improves SVG arrow preview:

- SVG preview still approximates TikZ arrows;
- but it visually distinguishes:
  - `>`;
  - `Stealth`;
  - `Latex`;
  - `Stealth[harpoon]`;
  - `Stealth[harpoon,swap]`;
- harpoon and harpoon-swap sides are distinguished;
- TikZ export itself remains authoritative.

Review location:

```text
docs/TIKZ_OUTPUT.md
```

## Goal

Update docs so they match Phase 28 behavior.

Specifically:

1. Update `docs/EDITING.md` so it no longer says explicit/bulk style edits always clear imported TikZ references.
2. Document the correct Phase 28 style-reference behavior:
   - explicit style edits clear `stylePresetId`;
   - imported TikZ references are preserved when possible;
   - explicit field edits become overrides after imported TikZ style references;
   - generated TikZ avoids duplicate options unless the user explicitly overrides fields.
3. Update `docs/TIKZ_OUTPUT.md` so it no longer claims SVG preview uses only generic triangular arrowheads.
4. Document the correct Phase 28 arrow-preview behavior:
   - SVG preview approximates but distinguishes `>`, `Stealth`, `Latex`, `Stealth[harpoon]`, and `Stealth[harpoon,swap]`;
   - generated TikZ remains the source of truth;
   - preview may still not exactly match TikZ/PDF output in every edge case.
5. Keep `docs/PREVIEW_UI.md` consistent with both docs.
6. Add or update doc consistency tests if the repository has them.
7. Run `npm test`, `npm run build`, and `git diff --check`.

## Scope

This is a targeted Phase 28J docs fix.

Implement:

- documentation updates in `docs/EDITING.md`;
- documentation updates in `docs/TIKZ_OUTPUT.md`;
- optional docs consistency tests if practical.

Do not implement:

- new style behavior;
- new arrow preview behavior;
- new UI behavior;
- new TikZ generation behavior;
- broad docs rewrite;
- new dependencies.

Do not change:

- `ContextQuickStyleBar` behavior;
- imported TikZ style model;
- style preset model;
- SVG arrow rendering;
- TikZ export;
- save/load;
- tests unrelated to doc consistency.

## 1. Update `docs/EDITING.md`

Find the section around bulk style editing / style shortcuts / multi-selection style editing.

Current stale wording says or implies:

```text
bulk style edits clear style preset/import references
```

Replace it with the Phase 28 behavior.

Suggested wording:

```markdown
Explicit style edits from the Inspector, bulk editor, or Preview quick style bar are treated as user overrides. They clear local `stylePresetId` values, because the object is no longer exactly following that local preset.

Imported TikZ style references are preserved when possible. If an object uses an imported TikZ style and the user changes an explicit field such as stroke width, the generated TikZ keeps the imported style reference and emits the explicit override after it, for example:

\draw[myImportedStyle, line width=0.8pt] ...

This keeps the TikZ source compact while making user overrides visible. The editor avoids duplicating options already provided by the imported style unless the user explicitly overrides those fields.
```

Adjust exact terminology to match the project:

- `stylePresetId`;
- `importedTikzStyleReferenceId`;
- "local preset";
- "imported TikZ style";
- "Preview quick style bar";
- "bulk style editing".

Important distinction to preserve:

```text
stylePresetId clear != importedTikzStyleReferenceId clear
```

If some operations still intentionally clear imported refs, document the exact exception. Do not overstate.

## 2. Update `docs/TIKZ_OUTPUT.md`

Find the stale arrow-preview section.

Remove or rewrite claims like:

```text
SVG preview draws approximate triangular arrowheads.
It does not attempt Stealth, Latex, or harpoon glyphs.
```

Replace with updated Phase 28 behavior.

Suggested wording:

```markdown
The SVG preview now draws approximate arrowhead families for the configured path arrow options. It distinguishes the default `>`, `Stealth`, `Latex`, `Stealth[harpoon]`, and `Stealth[harpoon,swap]` families, including the harpoon side for `swap`.

The preview is still an approximation of TikZ's `arrows.meta` rendering. The generated TikZ remains the source of truth, especially for exact glyph metrics, line joins, and edge cases involving decoration, occlusion, or 3D projection.
```

If the doc has a "known limitations" section, put the approximation caveat there.

## 3. Cross-check `docs/PREVIEW_UI.md`

`docs/PREVIEW_UI.md` reportedly already documents the correct newer behavior.

Check it for consistency with the edited docs.

Ensure all three docs agree on:

### Style behavior

- quick style bar can edit frequent fields;
- imported style dropdown exists;
- explicit field edits are overrides;
- local style presets and imported TikZ references are treated differently;
- no duplicate generated TikZ options unless explicit override.

### Arrow preview behavior

- SVG preview is improved and distinguishes arrow families;
- TikZ output remains authoritative.

Avoid introducing new contradictions.

## 4. Add lightweight docs tests if practical

If there are existing docs tests or documentation smoke tests, add assertions.

Possible tests:

1. `docs/EDITING.md` no longer contains the stale phrase:

```text
style preset/import references
```

or whatever exact stale wording exists.

2. `docs/EDITING.md` contains:

```text
stylePresetId
```

and:

```text
imported TikZ
```

or:

```text
importedTikzStyleReferenceId
```

in a section explaining their distinction.

3. `docs/TIKZ_OUTPUT.md` mentions:

```text
Stealth[harpoon]
```

and:

```text
Stealth[harpoon,swap]
```

4. `docs/TIKZ_OUTPUT.md` no longer says the preview does not attempt `Stealth`, `Latex`, or harpoon glyphs.

Only add tests if the repository already has a reasonable docs test pattern. Do not create brittle tests that make routine doc edits painful unless the project already does that.

## 5. Preserve implementation behavior

This is a docs-only fix unless small docs-test updates are added.

Do not alter source behavior.

After the fix:

- Phase 28 quick style behavior should be unchanged.
- Phase 28 arrow preview behavior should be unchanged.
- Tests/build should remain green.

## 6. Manual review checklist

After editing docs, manually check:

### `docs/EDITING.md`

- It clearly says explicit style edits clear `stylePresetId`.
- It does **not** say all imported references are cleared.
- It explains imported TikZ references are preserved when possible.
- It explains explicit fields become overrides after imported styles.
- It agrees with `docs/PREVIEW_UI.md`.

### `docs/TIKZ_OUTPUT.md`

- It says SVG arrow preview is approximate.
- It says SVG arrow preview distinguishes:
  - `>`;
  - `Stealth`;
  - `Latex`;
  - `Stealth[harpoon]`;
  - `Stealth[harpoon,swap]`.
- It says generated TikZ/PDF remains authoritative.
- It no longer claims those families are not attempted.

## 7. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Optional:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Only treat lint as required if the repository is already lint-clean.

## 8. Report after implementation

Please report:

- files modified;
- exact `docs/EDITING.md` behavior clarified;
- exact `docs/TIKZ_OUTPUT.md` arrow-preview behavior clarified;
- whether docs consistency tests were added;
- test results;
- build results;
- `git diff --check` result;
- remaining limitations, if any.
