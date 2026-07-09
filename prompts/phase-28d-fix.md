# Phase 28D Fix Prompt: Add style eyedropper and imported TikZ style controls to Context Quick Style Bar

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

Do not treat lint as a required gate if the repository still has the existing broad lint debt.

## Context

You are working on the StratifiedTikZ project.

Phase 28D added the Preview context quick style bar.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

The Preview context quick style bar does not expose the required style eyedropper controls or imported TikZ style dropdown.

Review locations:

```text
src/ui/ContextQuickStyleBar.tsx
src/ui/contextQuickStyleBar.ts
src/App.tsx
```

Current state:

- The context quick style bar appears for curves, points, sheets/regions, and labels.
- It returns `null` for coordinate anchors, which is correct.
- Stroke-width-like fields and point radius use `step: 0.1`.
- Numeric drafts allow invalid intermediate values and do not mutate until a valid commit.
- Mixed values and multi-selection edits route through the existing bulk style path.
- Slider changes are coalesced through `undoSourceDiagram`.
- Explicit scalar/style field overrides clear preset/imported references.
- TikZ output reflects changed style fields.

Missing required behavior:

- The quick bar does not expose style eyedropper copy/paste/apply controls.
- The quick bar does not expose compatible imported TikZ style preset/reference selection.
- Existing style clipboard handlers exist in `App.tsx`.
- Imported preset controls exist in the Inspector, likely through `UserStylePresetControls`.
- The quick bar currently only accepts scalar field changes and slider callbacks.

This leaves frequent style transfer/imported-style application outside the Preview shortcut workflow required for Phase 28D.

## Goal

Add compact Preview context quick style bar controls for:

1. Style eyedropper / style copy-paste.
2. Compatible imported TikZ style preset/reference selection.

Required behavior:

- Reuse existing style clipboard/copy/paste handlers where practical.
- Reuse existing imported style preset/reference logic, such as `UserStylePresetControls`, where practical.
- Keep imported style selection compact and searchable.
- Support compatible same-geometric-kind selections.
- Preserve the rule that explicit field overrides clear imported/preset references.
- Ensure applying imported styles does not create duplicated TikZ style options.
- Add tests covering quick-bar style paste/imported-style application and TikZ export behavior.

## Scope

This is a targeted Phase 28D fix.

Implement:

- style eyedropper/copy/paste controls in `ContextQuickStyleBar`;
- imported TikZ style dropdown/popover in the quick bar;
- quick-bar wiring in `App.tsx`;
- compatibility filtering by selected `geometricKind`;
- tests.

Do not implement:

- new TikZ style parser;
- new style import file formats;
- broad style model redesign;
- new geometry features;
- new layer behavior;
- broad toolbar redesign;
- new dependencies.

Do not change:

- existing scalar quick style fields;
- step `0.1` slider behavior;
- invalid numeric draft behavior;
- Inspector style controls, except for shared helper extraction if needed;
- existing imported style semantics;
- existing style clipboard semantics;
- TikZ output for diagrams without quick-bar imported style changes;
- save/load format unless already needed by imported style references;
- undo/redo semantics beyond one expected history entry per style action.

## 1. Inspect existing style clipboard and imported style controls

Inspect:

```text
src/App.tsx
src/ui/ContextQuickStyleBar.tsx
src/ui/contextQuickStyleBar.ts
src/ui/inspector/UserStylePresetControls.tsx
src/ui/inspector/*
src/model/styles*
src/model/importedTikzStyles.ts
src/tikz/generateTikz.ts
```

Find existing handlers around:

```text
src/App.tsx around existing copy/paste style handlers
```

Review says existing handlers are around:

```text
src/App.tsx:2048
```

Find imported preset UI and logic, likely in:

```text
UserStylePresetControls
```

The fix should avoid duplicating style business logic where possible.

## 2. Quick bar style eyedropper / copy-paste controls

Add compact controls to the context quick style bar.

Recommended UI:

```text
[Copy style] [Paste style] [Eyedropper]
```

or a compact single control with popover:

```text
Style ▾
  Copy style
  Paste style
  Eyedropper
```

If horizontal space is tight, prefer compact `Style…` / icon buttons.

### Required behavior

For a selected target or compatible multi-selection:

- `Copy style` copies the selected source object's style to the existing style clipboard.
- `Paste style` applies the existing style clipboard to the selected target(s), if compatible.
- `Eyedropper` enters source-pick mode:
  - user has selected target(s);
  - clicks a source object in Preview;
  - source style is applied to target(s) if compatible.

If eyedropper mode already exists, expose it from the quick bar. If only copy/paste exists, at minimum expose copy/paste from the quick bar and preserve existing eyedropper behavior if any.

### Compatibility

Apply only when source and target have compatible `geometricKind`.

Allowed examples:

```text
curve -> curve
point -> point
sheet/region -> sheet/region if existing style system treats them as compatible
label -> label
```

Rejected examples:

```text
curve -> sheet
point -> coordinate anchor
coordinate anchor -> anything
mixed incompatible selection
```

Coordinate anchors have no style and should not show the style quick bar or eyedropper target actions.

### Multi-selection

If target selection is a compatible same-geometric-kind multi-selection:

- paste/apply style to all targets;
- one undo history entry;
- atomic behavior:
  - if any target is incompatible, reject and do not partially apply.

### Do not copy

Style clipboard/eyedropper should not copy:

- geometry;
- id/name;
- layer, unless existing style clipboard intentionally includes it. Preferred: do not copy layer.
- coordinateRefs;
- label text content;
- path segment geometry;
- sheet geometry.

## 3. Quick bar imported TikZ style dropdown

Add a compact imported style selector to the context quick style bar.

Recommended UI:

```text
TikZ style ▾
```

or inside a compact `Style…` popover:

```text
Style…
  TikZ style
  Copy style
  Paste style
  Eyedropper
```

### Display conditions

Show the imported style selector only when useful:

- imported or user-defined TikZ styles exist; and
- current selection has a compatible `geometricKind`; and
- enough space is available, or it is placed inside `Style…`.

If no imported styles exist, hide the dropdown or show a disabled compact control with useful tooltip.

### Dropdown behavior

Requirements:

- compact;
- searchable;
- recent styles first if existing recent-style tracking exists or can be added cheaply;
- includes `None` / clear style option if existing style system supports clearing;
- shows current applied imported style/reference when selection is single or all selected targets share the same style;
- shows `Mixed` for multi-selection with different imported styles.

If `UserStylePresetControls` already provides most of this behavior, extract or wrap the logic for quick-bar use.

Do not duplicate a large Inspector component if it is too tall; prefer a compact wrapper.

## 4. Imported style application semantics

When applying an imported TikZ style from the quick bar:

- apply the style reference to the selected object(s);
- do not set explicit overlapping scalar fields at the same time;
- do not bloat generated TikZ with duplicate options already defined by the imported style;
- preserve existing local/imported style metadata.

Expected output after applying imported style:

```tex
\draw[myImportedStyle] ...
```

not:

```tex
\draw[myImportedStyle, draw=red, line width=0.4pt, opacity=1] ...
```

unless those explicit options were actual user overrides.

### Explicit override behavior

If the user subsequently edits a quick scalar field, such as stroke width:

```text
stroke width slider -> 0.8
```

then that field becomes an explicit override and should be emitted after the imported style:

```tex
\draw[myImportedStyle, line width=0.8pt] ...
```

The existing Phase 28D behavior already clears preset/imported references for explicit scalar overrides according to the review. Preserve that behavior.

If the existing rule is "explicit scalar override clears imported reference entirely", preserve the current project rule. But make sure it is tested and does not produce duplicate style options.

The key invariant:

```text
Applying imported style should be compact.
Explicit field changes should be explicit and should not duplicate stale imported-derived values unintentionally.
```

## 5. Quick bar wiring in App

Update the quick bar props in `App.tsx`.

Currently review says quick bar only accepts:

```text
scalar field changes
slider callbacks
```

Add props/callbacks for:

```ts
onCopyStyle
onPasteStyle
onStartStyleEyedropper
onApplyImportedStyle
onClearImportedStyle
availableImportedStyles
currentImportedStyleState
styleClipboardState
```

Exact names can differ.

Requirements:

- callbacks reuse existing App handlers where practical;
- no diagram mutation occurs from disabled/incompatible controls;
- undo/redo works through existing history paths;
- status messages match existing style actions.

## 6. Tests

Add focused tests.

### Quick-bar control visibility tests

1. Curve selection shows style copy/paste/eyedropper controls or a compact Style menu containing them.

2. Curve selection shows imported TikZ style dropdown when imported styles exist.

3. Coordinate anchor selection does not show style controls.

4. No imported styles means imported style dropdown hidden or disabled.

5. Multi-selection of same geometric kind shows compatible controls.

6. Mixed incompatible selection hides/disables controls.

### Style clipboard / eyedropper tests

7. Quick-bar copy style from a curve copies style clipboard.

8. Quick-bar paste style applies copied curve style to selected curve.

9. Quick-bar paste style applies to same-kind multi-selected curves.

10. Quick-bar paste rejects curve style onto sheet and does not partially mutate.

11. Geometry/layer/id/text are not copied.

12. Undo/redo works for quick-bar paste.

13. If eyedropper mode is exposed, quick-bar eyedropper applies source style to selected target(s).

14. Eyedropper rejects incompatible source.

### Imported style dropdown tests

15. Imported style dropdown/search lists imported styles.

16. Search filters imported styles.

17. Applying imported style from quick bar sets style reference on selected object.

18. Applying imported style to same-kind multi-selection applies to all targets atomically.

19. Imported style dropdown shows current style or mixed state.

20. Clearing imported style works if supported.

21. Undo/redo works for quick-bar imported style application.

### TikZ generation tests

22. Applying imported style from quick bar emits compact TikZ:

```tex
[myStyle]
```

without redundant explicit color/width/opacity options.

23. After applying imported style, changing stroke width through quick bar emits explicit override according to current project policy.

24. Existing explicit override behavior still clears imported references if that is the current rule.

25. Inline output has no blank lines.

26. 4-space indentation preserved.

### Regression tests

27. Existing scalar quick style slider tests still pass.

28. Inspector imported preset controls still work.

29. Existing style eyedropper/copy/paste tests still pass.

30. Style import/save/load unaffected.

## 7. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Select a path.
2. Confirm quick bar shows style controls.
3. Copy style from one path and paste to another via quick bar.
4. Confirm geometry/layer unchanged.
5. Import or use an existing imported TikZ style.
6. Select a path and apply imported style from quick bar.
7. Generate TikZ.
8. Confirm output uses the style reference compactly.
9. Change stroke width from quick bar.
10. Confirm explicit width behavior is correct.
11. Try applying curve style to sheet.
12. Confirm rejected.
13. Multi-select compatible paths and apply imported style.
14. Undo/redo.

## 8. Preserve existing behavior

Do not regress:

- scalar quick style bar fields;
- stroke width / point radius sliders;
- invalid numeric drafts;
- mixed multi-selection editing;
- Inspector style editing;
- imported style import/parser;
- style manager;
- style eyedropper/copy/paste existing workflows;
- TikZ export;
- save/load;
- undo/redo;
- inline no-blank-lines.

## 9. Verification

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

## 10. Report after implementation

Please report:

- files modified;
- quick-bar style clipboard controls added;
- quick-bar eyedropper behavior;
- imported TikZ style dropdown behavior;
- search/recent/mixed state behavior;
- same-geometric-kind compatibility policy;
- imported style duplicate-option avoidance behavior;
- explicit override behavior after imported style application;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
