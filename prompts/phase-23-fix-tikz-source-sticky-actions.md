# Phase 23 Fix Prompt: Keep Copy/Download TikZ buttons sticky above the source window

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

Phase 23 UI refinement is underway or complete.

Current UI issue:

- In the Generated TikZ / TikZ Source window, the `3D Visibility` controls take enough vertical space that the user has to scroll before seeing the `Copy TikZ` and `Download TikZ` buttons.
- This makes the most frequent actions hard to access.
- The user wants `Copy TikZ` and `Download TikZ` to be always visible.
- Specifically, these two buttons should be placed flush along the top edge of the source-code display window.

Desired behavior:

```text
Generated TikZ / Source panel

+-------------------------------------------------+
| Copy TikZ   Download TikZ        other compact  |
|-------------------------------------------------|
| generated TikZ source code                      |
| ...                                             |
| ... scrollable source area ...                  |
+-------------------------------------------------+
```

or equivalent.

The key requirement is:

- `Copy TikZ` and `Download TikZ` should remain visible without scrolling, even when `3D Visibility` controls or other export options are expanded.

## Goal

Refactor the Generated TikZ panel layout so that:

1. `Copy TikZ` and `Download TikZ` are pinned/sticky at the top edge of the TikZ source/code display area.
2. These buttons remain visible at all times while the Generated TikZ panel is visible.
3. The generated source code area scrolls independently.
4. Large option sections such as `3D Visibility` do not push the copy/download buttons out of view.
5. Existing TikZ generation, copy, download, standalone/inline mode, visibility options, and formatting behavior remain unchanged.

## Scope

This is a targeted UI/layout fix.

Implement:

- a sticky or fixed header/action row for the TikZ source panel;
- always-visible `Copy TikZ` and `Download TikZ` buttons;
- internal scrolling for source code and/or option sections;
- layout cleanup so `3D Visibility` controls cannot hide copy/download actions;
- tests for component structure/state if practical.

Do not implement:

- new TikZ export features;
- new visibility algorithms;
- new source formatting changes;
- new geometry features;
- new dependencies;
- broad UI redesign beyond the Generated TikZ panel layout.

Do not change:

- TikZ source generation;
- standalone/inline export modes;
- 4-space indentation;
- inline no-blank-lines behavior;
- 3D visibility option semantics;
- copy/download file contents;
- save/load;
- SVG preview;
- undo/redo.

## 1. Inspect current Generated TikZ panel

Inspect components/CSS related to:

- Generated TikZ panel;
- TikZ Source panel;
- Copy TikZ button;
- Download TikZ button;
- export mode selector;
- 3D Visibility controls;
- source code `<textarea>`, `<pre>`, or code display component;
- scroll containers.

Likely files may include:

- `src/App.tsx`;
- `src/ui/...`;
- CSS files or modules;
- any source panel component.

Find why the action buttons are inside a scrollable region below `3D Visibility`.

## 2. Create a source panel header/action row

Move or wrap `Copy TikZ` and `Download TikZ` into a header row that is not part of the scrollable source/options content.

Preferred structure:

```tsx
<section className="tikz-source-panel">
  <header className="tikz-source-panel__header">
    <div className="tikz-source-panel__title">Generated TikZ</div>
    <div className="tikz-source-panel__actions">
      <button>Copy TikZ</button>
      <button>Download TikZ</button>
    </div>
  </header>

  <div className="tikz-source-panel__body">
    ...
  </div>
</section>
```

or, if the action row should align directly with the source code display:

```tsx
<div className="tikz-code-shell">
  <div className="tikz-code-shell__sticky-actions">
    <button>Copy TikZ</button>
    <button>Download TikZ</button>
  </div>
  <pre className="tikz-code-shell__code">...</pre>
</div>
```

Requirements:

- action row remains visible without scrolling;
- buttons are aligned along the top edge of the source code display window;
- buttons do not overlap source text;
- buttons remain clickable;
- buttons have accessible labels.

## 3. Scrolling behavior

Separate scroll regions clearly.

Recommended:

```text
Generated TikZ panel
  Header/action row: non-scrolling
  Optional export options area: compact/collapsible or separate scroll
  Source code area: scrollable
```

or:

```text
Generated TikZ panel
  Top sticky action row
  Body scrolls, but action row uses position: sticky; top: 0
```

Preferred:

- `Copy TikZ` / `Download TikZ` are outside the main scrollable area.

Acceptable:

- use `position: sticky; top: 0; z-index: ...` inside the scroll container, as long as it remains visible and does not cover code.

Do not require the user to scroll past `3D Visibility` to reach copy/download buttons.

## 4. 3D Visibility controls placement

The `3D Visibility` controls should not hide the copy/download actions.

Acceptable approaches:

### Option A: Move 3D Visibility below the sticky header

The action row stays above, and `3D Visibility` can remain in the panel body.

### Option B: Collapse 3D Visibility by default

If it is large, make it collapsible or keep existing collapse behavior. But this is secondary.

### Option C: Move 3D Visibility into a compact options row

Only if easy.

Required:

- do not remove 3D Visibility controls;
- do not change their semantics;
- they remain reachable;
- they do not push `Copy TikZ` / `Download TikZ` out of view.

## 5. Button behavior

Preserve existing behavior.

`Copy TikZ`:

- copies the currently displayed/generated source;
- respects selected export mode;
- includes current diagram state;
- works after source updates.

`Download TikZ`:

- downloads the currently displayed/generated source;
- respects current file naming behavior;
- works after source updates.

No behavior change other than placement.

## 6. Layout and style requirements

The new action row should be visually compact.

Requirements:

- positioned flush with or immediately adjacent to the top edge of the source display window;
- does not consume excessive vertical height;
- remains visually distinct from source code;
- works in light/dark or current theme if applicable;
- buttons remain usable on narrow screens;
- if narrow, buttons may wrap but should remain visible.

Suggested CSS:

```css
.tikz-source-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
}

.tikz-source-panel__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
}

.tikz-source-panel__actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.tikz-source-panel__body {
    min-height: 0;
    overflow: auto;
}
```

or sticky variant:

```css
.tikz-source-actions {
    position: sticky;
    top: 0;
    z-index: 2;
    background: ...;
}
```

## 7. Preserve TikZ source panel sizing

Do not make the source panel so tall that it overwhelms the preview.

Requirements:

- source panel remains below Preview/Camera panel according to Phase 23C;
- source panel still scrolls internally if long;
- generated source text remains readable;
- no horizontal layout break.

## 8. Tests

Add tests where practical.

### Component/helper tests

1. `Copy TikZ` and `Download TikZ` are rendered in the source panel header/action row.

2. `Copy TikZ` and `Download TikZ` are not nested inside the scrollable `3D Visibility` options body if testable by DOM structure/class.

3. Expanding or showing `3D Visibility` controls does not remove/unmount copy/download buttons.

4. Copy button still calls existing copy handler.

5. Download button still calls existing download handler.

6. Export mode changes still update copied/downloaded source if existing tests cover it.

### Regression tests

7. Generated TikZ string unchanged by layout state.

8. Inline/standalone mode output unchanged.

9. 3D Visibility option changes still affect output as before.

10. Source panel open/collapsed state, if any, is UI-only.

If CSS layout is hard to test, add DOM/component tests and rely on manual verification for visual stickiness.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual tests:

1. Open a 3D diagram so `3D Visibility` controls are available.
2. Open/expand the Generated TikZ / TikZ Source panel.
3. Confirm `Copy TikZ` and `Download TikZ` are visible immediately.
4. Confirm they sit along the top edge of the source code display area.
5. Scroll through the TikZ source or options.
6. Confirm `Copy TikZ` and `Download TikZ` remain visible.
7. Expand/collapse or change `3D Visibility` controls.
8. Confirm copy/download buttons remain visible.
9. Click `Copy TikZ`; confirm copied source is correct.
10. Click `Download TikZ`; confirm download still works.
11. Switch to inline math mode.
12. Confirm copy/download still use the current mode.
13. Resize browser narrower.
14. Confirm buttons remain visible and usable.

## 10. Preserve existing behavior

Do not regress:

- TikZ source generation;
- Copy TikZ behavior;
- Download TikZ behavior;
- export mode selector;
- 3D Visibility controls;
- inline no-blank-lines;
- 4-space indentation;
- source panel scrolling;
- Preview/Camera layout;
- save/load;
- undo/redo;
- SVG preview;
- toolbar/layer/inspector overlays.

## 11. Verification

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

## 12. Report after implementation

Please report:

- files modified;
- source panel layout changes;
- whether buttons are outside scroll area or sticky;
- how 3D Visibility controls are positioned relative to action row;
- copy/download behavior preservation;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
