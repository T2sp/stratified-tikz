# Phase 21B Fix Prompt: Prevent Add grid direct mode canvas clicks from creating labels

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

Phase 21B implemented the floating SVG Preview toolbar and tool-model cleanup.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

`Add grid` direct mode can still create a label from a canvas click.

Observed behavior:

- The new toolbar exposes `Add grid` as a direct-input menu item.
- However, `SvgDiagram` still receives `onCanvasClick` for every non-select tool.
- `handlePreviewCreationClick` only ignores direct mode for point/label.
- `applyCursorCreationPoint` has no `createGrid` branch.
- Therefore, `createGrid` falls through to the text-label creation path.
- Result:
  - Select `Add grid` → `Direct input`;
  - click the SVG Preview canvas;
  - a free text label is created.
- This is incorrect.

`Add grid` in direct mode should not create labels from canvas clicks.

## Goal

Fix `Add grid` direct mode so preview canvas clicks do nothing, rather than creating free text labels.

Required:

1. Canvas clicks must not create labels when the active tool is `createGrid`.
2. Direct-only creation modes should not receive cursor canvas creation behavior unless explicitly supported.
3. Existing cursor creation behavior for other tools must remain unchanged.
4. Add a focused regression test or helper test for Add grid direct mode.

## Scope

This is a targeted Phase 21B fix.

Implement:

- safe canvas-click handling for `createGrid` direct mode;
- no-op or disabled `onCanvasClick` for direct-only creation modes;
- explicit handling of `createGrid` in cursor creation dispatch if needed;
- tests.

Do not implement:

- new grid creation features;
- new direct grid form behavior beyond preserving existing one;
- Phase 21C direct input drawer;
- new toolbar design;
- broad tool-model refactor;
- new geometry features;
- new dependencies.

Do not change:

- diagram data model;
- grid data model;
- existing direct grid creation form behavior;
- existing cursor creation for point/label/path/sheet;
- SVG rendering semantics;
- TikZ generation;
- save/load;
- undo/redo.

## 1. Inspect current creation click flow

Inspect:

- `src/App.tsx`;
- `handlePreviewCreationClick`;
- `applyCursorCreationPoint`;
- active tool state / active creation tool enum;
- coordinate input mode / direct-vs-cursor state;
- `SvgDiagram` call site where `onCanvasClick` is passed;
- toolbar code that selects Add grid direct mode.

Review notes mention:

- `SvgDiagram` receives `onCanvasClick` for every non-select tool around `src/App.tsx`.
- `handlePreviewCreationClick` only ignores direct mode for point/label.
- `applyCursorCreationPoint` lacks a `createGrid` branch and falls through to `addTextLabelWithResult`.

Find the exact fallthrough and stop it.

## 2. Fix policy

Choose one clear policy.

Preferred policy:

### Policy A: Disable canvas click handler for direct-only creation states

When the current tool/input state is direct mode and the active tool does not support cursor placement, pass no `onCanvasClick` to `SvgDiagram`, or have the handler no-op immediately.

Examples:

```ts
const shouldHandlePreviewCanvasClick =
  activeTool !== "select" &&
  coordinateInputMode !== "direct" &&
  activeToolSupportsCursorCreation(activeTool);
```

or equivalent.

Then:

```tsx
<SvgDiagram
  onCanvasClick={shouldHandlePreviewCanvasClick ? handlePreviewCreationClick : undefined}
/>
```

This prevents accidental fallthroughs.

### Policy B: Explicit no-op in handler

At the top of `handlePreviewCreationClick` or `applyCursorCreationPoint`:

```ts
if (activeTool === "createGrid" && coordinateInputMode === "direct") {
  return;
}
```

This is acceptable as a minimal fix, but less robust than Policy A.

### Policy C: Exhaustive switch in cursor creation dispatch

Make `applyCursorCreationPoint` use an exhaustive switch and explicitly handle all creation tool kinds.

For `createGrid`:

```ts
case "createGrid":
  return { diagram, selection, status: "Use the direct grid panel to create a grid." };
```

or no-op.

Preferred final approach:

- Use an explicit `activeToolSupportsCursorCreation(...)` helper.
- Use exhaustive switch/no fallthrough in `applyCursorCreationPoint`.
- Add tests for the helper and the `createGrid` path.

## 3. Define cursor-click-supported tools

Create or update a helper such as:

```ts
function activeToolSupportsCursorCreation(tool: ActiveTool): boolean
```

or:

```ts
function shouldHandlePreviewCreationClick(args): boolean
```

Expected:

Cursor-click tools likely include:

- add point in cursor mode;
- add label in cursor mode;
- add path / polyline / cubic / arc cursor creation modes;
- add polygon sheet cursor creation;
- surface boundary picking modes where clicking canvas/objects is intended.

Direct-only tools should not include:

- createGrid direct mode;
- any direct form tool that does not use canvas placement.

Be careful:

- Some Add sheet modes use clicking existing paths/points rather than blank canvas.
- Do not break Coons/Ruled sequential boundary picking if it uses SVG object clicks.
- This fix is specifically about blank canvas click causing label creation in Add grid direct mode.

If object-click picking for Coons/Ruled is handled through different props/events, preserve it.

## 4. Remove fallthrough-to-label behavior

The creation dispatch should not silently fall through to `addTextLabelWithResult`.

If there is a switch/if chain like:

```ts
if (tool === "addPoint") ...
if (tool === "addPolyline") ...
return addTextLabelWithResult(...)
```

replace it with an explicit dispatch.

Required:

- `createGrid` must not fall through to label creation.
- Unknown/unhandled creation tools should no-op or return a clear status, not create labels.
- If TypeScript can enforce exhaustiveness, use it.

Example:

```ts
switch (activeTool) {
  case "addPoint":
    ...
  case "addLabel":
    ...
  case "addPath":
    ...
  case "addSheet":
    ...
  case "createGrid":
    return noChange("Use direct input to create a grid.");
  default:
    return assertNever(activeTool);
}
```

Exact structure depends on current tool model.

## 5. Add grid direct mode behavior

When Add grid direct mode is active:

- preview canvas click should not mutate the diagram;
- no label should be created;
- no point/path/sheet should be created;
- status may say:

```text
Use the direct input panel to create a grid.
```

or no status change.

Do not create a draft grid on blank canvas unless already designed.

## 6. Preserve direct grid form behavior

The direct grid form/menu item should still work.

Requirements:

- user can still create grid using direct input controls;
- created grid is selected if existing behavior does that;
- undo/redo works;
- TikZ/SVG output works.

Do not make Add grid unusable.

## 7. Tests

Add focused tests.

### Helper tests

1. `activeToolSupportsCursorCreation("createGrid", direct)` returns false, or equivalent helper behavior.

2. Direct-only mode returns false for canvas click handling.

3. Cursor-supported tools still return true.

### Creation dispatch tests

4. Calling preview creation handler in Add grid direct mode does not mutate diagram.

5. Calling preview creation handler in Add grid direct mode does not create a label.

6. `applyCursorCreationPoint` or equivalent explicitly no-ops for `createGrid`.

7. Unhandled creation tool cannot fall through to label creation, if testable.

### UI/render tests if infrastructure exists

8. `SvgDiagram` receives no `onCanvasClick` or a no-op in Add grid direct mode.

9. Clicking preview in Add grid direct mode leaves strata/labels counts unchanged.

### Regression tests

10. Add point cursor mode still creates point.

11. Add label cursor mode still creates label.

12. Add path cursor mode still works.

13. Add sheet cursor/picking modes still work.

14. Direct grid creation form still creates grid.

15. Coons/Ruled boundary picking is not broken.

## 8. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test:

1. Open the app.
2. Select Add grid.
3. Select Direct input / open the direct grid option.
4. Click empty SVG Preview canvas.
5. Confirm no label is created.
6. Confirm no diagram object is created.
7. Use the direct grid form to create a grid.
8. Confirm grid appears and TikZ updates.
9. Switch to Add label cursor mode.
10. Click canvas.
11. Confirm label creation still works.
12. Switch to Add point cursor mode.
13. Confirm point creation still works.
14. Test Add path cursor mode.
15. Test Add sheet / Coons/Ruled boundary picking if relevant.

## 9. Preserve existing behavior

Do not regress:

- floating toolbar layout;
- toolbar collapse/expand;
- Undo/Redo overlay;
- trash/remove selected;
- Add path consolidation;
- Fill paths visibility rule;
- default cursor input;
- direct grid form;
- cursor creation for supported tools;
- Coons/Ruled boundary picking;
- SVG pointer mapping;
- camera/work-plane interactions;
- save/load;
- undo/redo;
- TikZ export.

## 10. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 11. Report after implementation

Please report:

- files modified;
- root cause of Add grid direct mode creating labels;
- chosen fix policy;
- whether `onCanvasClick` is disabled or handler no-ops;
- how creation dispatch now avoids fallthrough;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
