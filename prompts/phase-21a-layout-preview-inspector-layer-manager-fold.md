# Phase 21A Implementation Prompt: Inspector/Preview layout and foldable Layer Manager

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

Phase 20 is complete.

The editor now has many controls and panels:

- SVG Preview;
- Inspector;
- Layer Manager inside or near the Inspector;
- TikZ source panel;
- toolbar controls;
- style manager / variables / grid / camera / visibility controls;
- many geometry creation and editing tools.

Current UI problem:

1. The Inspector's Layer Manager is always expanded and takes too much vertical space.
2. The Inspector / Layer Manager expansion can make the editor hard to use.
3. The desired editor layout is now:

```text
-----------------------------------------
|                       |               |
|      SVG Preview      |   Inspector   |
|                       |               |
-----------------------------------------

             TikZ source

-----------------------------------------
```

That is:

- SVG Preview on the left;
- Inspector on the right;
- SVG Preview and Inspector should have the same vertical extent in the top content area;
- TikZ source should appear below the Preview/Inspector row;
- SVG Preview should be larger than it currently is;
- Inspector should scroll internally rather than pushing the TikZ source or preview around;
- Layer Manager inside Inspector should be foldable/collapsible.

## Goal

Refactor the editor layout so that:

1. SVG Preview and Inspector are side-by-side in the main top workspace.
2. The Inspector's vertical height matches the SVG Preview area's height.
3. The TikZ source panel is below the Preview/Inspector row.
4. SVG Preview is given more horizontal and vertical space.
5. Inspector content scrolls internally when too tall.
6. The Layer Manager inside the Inspector is foldable/collapsible.
7. The layout remains usable on narrower browser widths.
8. No model, SVG rendering, TikZ generation, save/load, undo/redo, or geometry behavior changes.

## Scope

This is a UI/layout fix.

Implement:

- main editor layout restructuring;
- side-by-side SVG Preview / Inspector row;
- TikZ source below that row;
- Inspector height matching Preview height;
- internal scrolling for Inspector content;
- foldable/collapsible Layer Manager;
- responsive CSS behavior;
- small UI-state helpers/tests if practical.

Do not implement:

- new geometry features;
- new TikZ export features;
- new layer operations;
- new style manager features;
- new multi-selection behavior;
- broad visual redesign beyond layout;
- new dependencies;
- drag-resizable panes unless trivial and safe.

Do not change:

- diagram data model;
- selection model;
- layer manager model;
- SVG preview semantics;
- TikZ source generation;
- save/load format;
- undo/redo semantics;
- camera/work-plane/layer/style manager logic.

## 1. Main layout target

Reorganize the editor content into a layout equivalent to:

```text
App
  Toolbar / top controls

  Main work area
    Preview + Inspector row
      SVG Preview panel
      Inspector panel

    TikZ source panel
```

Target visual structure:

```text
-----------------------------------------
|                       |               |
|      SVG Preview      |   Inspector   |
|                       |               |
-----------------------------------------
|                                       |
|              TikZ source              |
|                                       |
-----------------------------------------
```

Requirements:

- Preview and Inspector are in the same row.
- TikZ source spans below the row.
- Preview takes the larger horizontal share.
- Inspector has a reasonable fixed/min/max width.
- The top row should have a meaningful height, not collapse to content.
- The Inspector should not push the TikZ source down by expanding content.
- The SVG Preview should not shrink dramatically when the Inspector has many controls.

Suggested CSS approach:

```css
.editor-workspace {
    display: grid;
    grid-template-rows: minmax(520px, 1fr) auto;
    gap: 1rem;
    min-height: 0;
}

.preview-inspector-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
    gap: 1rem;
    min-height: 0;
    align-items: stretch;
}

.preview-panel,
.inspector-panel {
    min-height: 0;
    height: 100%;
}

.inspector-panel {
    overflow: auto;
}
```

Exact values may differ.

## 2. SVG Preview should be larger

The SVG Preview should be visually larger than before.

Requirements:

- left column gets more horizontal space than Inspector;
- preview panel can grow with viewport height;
- preview is not pushed down by Inspector expansion;
- preview controls/overlays such as camera overlay still work;
- preview remains responsive.

If the current preview has a fixed small height, increase or remove it.

Avoid:

- hard-coded tiny preview heights;
- layout that makes preview shorter than Inspector;
- preview being pushed below Inspector controls.

## 3. Inspector height and internal scrolling

The Inspector should match the top row height and scroll internally.

Requirements:

- Inspector panel height aligns with SVG Preview panel height;
- Inspector content can exceed panel height;
- overflow-y scroll appears inside Inspector;
- toolbar/workspace/TikZ source do not shift when Inspector sections expand;
- scroll does not hide controls permanently;
- on narrower screens, Inspector remains usable.

Important CSS detail:

If using flex/grid, make sure parent containers allow child scrolling:

```css
min-height: 0;
```

on relevant grid/flex children.

## 4. Foldable Layer Manager inside Inspector

Make the Inspector's Layer Manager foldable/collapsible.

Requirements:

- Layer Manager has a visible header.
- Header shows compact summary when collapsed, for example:

```text
Layer Manager ▸  5 layers
```

or:

```text
Layer Manager ▾  5 layers, 12 elements
```

- User can expand/collapse.
- Collapse hides the detailed layer rows/operations.
- Existing Layer Manager operations still work when expanded:
  - rename;
  - swap;
  - duplicate;
  - delete;
  - translate;
  - visibility/locking;
  - any polish/status messages.
- Collapsed/expanded state is UI state only.
- Do not store Layer Manager fold state in `Diagram`.
- Folding does not affect layer visibility/filtering semantics.
- Folding does not affect TikZ output.
- Folding does not affect save/load.

Preferred default:

- collapsed by default when the Inspector opens, unless there is an existing user setting.
- If this would hide important layer controls too aggressively, default to expanded but remember collapsed state in UI state.

Choose a simple predictable policy and report it.

## 5. Layer Manager scroll behavior when expanded

When expanded, Layer Manager details should still be usable.

Requirements:

- if many layers exist, the Layer Manager detail area scrolls or fits within Inspector scroll;
- duplicate/delete/etc. controls remain reachable;
- no horizontal clipping of operation buttons;
- long layer names do not break layout;
- no toolbar-level scroll is forced just because imported styles/layers are many.

## 6. TikZ source below the Preview/Inspector row

Move or style the TikZ source panel so it appears below the Preview/Inspector row.

Requirements:

- TikZ source spans the full available width or a clearly defined wide panel below;
- TikZ source remains copyable/downloadable;
- TikZ source still updates live;
- standalone/inline mode selector remains accessible;
- source panel can scroll internally if long;
- source panel does not squeeze the Preview/Inspector row too much.

Suggested:

```css
.tikz-source-panel {
    max-height: 40vh;
    overflow: auto;
}
```

or an existing source panel layout equivalent.

Do not remove any TikZ source controls.

## 7. Responsive behavior

For narrow windows, the layout should remain usable.

Acceptable behavior:

- switch to a single-column layout:
  - Preview;
  - Inspector;
  - TikZ source;
- or keep side-by-side with horizontal scroll if that is already the app pattern.

Preferred responsive CSS:

```css
@media (max-width: 900px) {
    .preview-inspector-row {
        grid-template-columns: 1fr;
    }
}
```

Requirements:

- no overlap;
- no permanently hidden Inspector controls;
- preview remains visible;
- TikZ source remains accessible.

## 8. Preserve preview overlays and interactions

Ensure layout changes do not break:

- SVG coordinate mapping;
- click selection;
- cursor creation;
- drag handles;
- camera overlay controls;
- camera drag/pan;
- work-plane preview;
- coordinate source highlights;
- auto-visibility rendering.

If the preview wrapper changes, verify all pointer coordinate mapping still uses the correct SVG element/viewBox.

## 9. Tests

This is mostly layout/CSS, so do not add new heavy React testing dependencies.

Add tests if helpers/components are testable.

Good tests:

1. Layer Manager collapsed state toggles.
2. Collapsed Layer Manager hides detail rows.
3. Expanded Layer Manager shows detail rows.
4. Fold state is UI-only and not saved in diagram JSON.
5. Existing layer operations still callable when expanded if component/helper-testable.
6. TikZ source generation unchanged by layout state.
7. SVG/TikZ output unaffected by Layer Manager collapsed state.

If there is existing component testing infrastructure, add a small test for the collapsible Layer Manager.

Otherwise, rely on manual verification plus existing tests.

## 10. Manual verification checklist

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify layout:

1. Open the app.
2. Confirm SVG Preview is on the left.
3. Confirm Inspector is on the right.
4. Confirm SVG Preview and Inspector have the same vertical extent.
5. Confirm SVG Preview is larger than before.
6. Confirm TikZ source is below both Preview and Inspector.
7. Resize browser taller/wider and confirm Preview grows.
8. Resize browser narrower and confirm layout remains usable.

Verify Inspector:

9. Select an element.
10. Confirm Inspector content is inside the right panel.
11. Expand sections.
12. Confirm Inspector scrolls internally and does not push Preview/TikZ source down.

Verify Layer Manager folding:

13. Locate Layer Manager in Inspector.
14. Collapse it.
15. Confirm detailed rows disappear.
16. Expand it.
17. Confirm detailed rows and operations reappear.
18. Rename/duplicate/delete/translate if safe in a test diagram.
19. Confirm layer operations still work.

Verify interactions:

20. Click/select objects in SVG Preview.
21. Create a point/path/sheet.
22. Drag a geometry handle.
23. Use camera overlay if 3D.
24. Confirm pointer mapping still works.
25. Confirm TikZ source updates.

Verify source:

26. Confirm TikZ source panel scrolls.
27. Copy/download TikZ source.
28. Switch standalone/inline mode.
29. Confirm source updates.

## 11. Preserve existing behavior

Do not regress:

- selection;
- cursor creation;
- direct creation;
- drag handles;
- camera controls;
- work-plane controls;
- layer manager operations;
- style manager;
- variable manager;
- grid controls;
- auto-visibility controls;
- SVG preview rendering;
- TikZ generation;
- copy/download;
- save/load;
- undo/redo;
- responsive behavior.

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
- new layout structure;
- CSS strategy;
- Preview/Inspector sizing behavior;
- TikZ source placement;
- Layer Manager fold behavior;
- default fold state;
- responsive behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
