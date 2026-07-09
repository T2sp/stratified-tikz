# Phase 28E Implementation Prompt: Toolbar eyedropper and imported TikZ style shortcut dropdown

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
## Project context

You are working on the StratifiedTikZ project.

Current public repository:

```text
https://github.com/T2sp/stratified-tikz
```

The editor already has mature core editing features:

- 2D and 3D diagrams;
- SVG/PGF Preview-centered editing;
- cursor and direct creation;
- coordinate anchors and coordinate references;
- symbolic variables;
- global and work-plane-local symbolic coordinates;
- cursor snapping;
- multi-selection and bulk editing;
- coordinate-anchor multi-selection/translation;
- symbolic-aware translation;
- path concatenation;
- path inline nodes and path splitting;
- style eyedropper;
- selection cycling;
- layer palette/window;
- custom work planes and camera/view controls;
- paths with arrows;
- 2D braiding/string-diagram crossings;
- grids/lattices;
- points, labels, paths, sheets, filled regions/sheets, ruled surfaces, Coons patches, and curved surfaces;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 28 is a preview-first UI, style shortcut, work-plane UX, SVG export, arrow-preview, and help/tutorial phase.

High-level design principles:

- SVG Preview is the main workspace.
- Reduce scrolling during editing.
- Reduce toolbar/palette calls during editing.
- Keep frequent style edits available from Preview toolbar shortcuts.
- Keep Inspector for detailed editing.
- Keep TikZ source/export readable and unchanged unless the user explicitly changes diagram/style data.
- UI-only state must not be saved into `Diagram`.
- Exported TikZ must keep 4-space indentation.
- Inline math output must contain no blank lines.
- Preserve save/load, undo/redo, coordinate anchors, coordinate refs, symbolic input, work-plane-local coordinates, layers, camera/view, arrows, braiding, path inline nodes/splitting, and existing geometry semantics.

Important user-specified UI requirements:

- SVG Preview height should expand to roughly 90% of the browser viewport.
- Example bar should not consume editing space; after editing begins it should collapse into a compact/dropdown control.
- Export SVG button should be sticky at the right-bottom below the Preview frame, protruding outside the frame.
- Toolbar background should be translucent.
- Toolbar buttons should also be translucent, but button text must remain fully opaque/readable.
- Load-JSON variable-resolution modal must appear above toolbar and all preview overlays.
- Coons direction window should auto-close when leaving Coons workflow or selecting other tools/subtools.
- 3D work-plane editor should be a Preview overlay near the left-bottom, similar in spirit to the current layer manager.
- 3D Add coordinate / Add point with active work-plane-local coordinates should support polar input in the work plane.
- Work-plane local polar input should show the active work-plane origin near the input.
- Work-plane setup UX should list methods in this order:
  1. Pick 3 existing points;
  2. Origin + normal vector;
  3. Custom 3 points.
- Origin + normal vector should use normal-vector theta/phi input with a small normal-vector preview.
- Arrow previews in SVG should look like the generated TikZ arrows, including `>`, `Stealth`, `Latex`, `Stealth[harpoon]`, and `Stealth[harpoon,swap]`.
- Context quick style bar should expose frequently changed style fields:
  - curve/path stroke color;
  - curve/path stroke width;
  - arrows;
  - point fill/color;
  - point radius;
  - sheet fill/opacity/stroke width;
  - label color/scale where applicable;
  - style eyedropper;
  - imported TikZ style dropdown if it does not clutter the toolbar.
- Stroke-width-like fields and point radius should use a snapped slider with step `0.1` plus custom numeric input.
- Numeric text inputs should allow temporary invalid drafts and show warnings instead of blocking intermediate input, so `.5`, `.`, `-`, `1e` can be typed.
- Imported TikZ styles in the shortcut bar should be compact/searchable and should avoid duplicating options in generated TikZ unless the user explicitly overrides a field.


## Goal

Expose style eyedropper and imported TikZ style application directly from the Preview toolbar/context quick style bar.

Core requirements:

- style eyedropper callable from toolbar;
- imported TikZ style compact dropdown if imported styles exist and space allows;
- dropdown searchable and recent-first;
- imported styles should not cause duplicate generated TikZ options unless user explicitly overrides fields;
- apply only to compatible same-geometricKind targets;
- works with multi-selection.

## Scope

Implement:

- toolbar eyedropper shortcut;
- compact imported TikZ style dropdown/popover;
- recent styles;
- search/filter;
- imported style + explicit override model integration if not already present;
- tests.

Do not implement:

- new TikZ style parser;
- new style import file formats;
- broad style model redesign beyond needed override handling;
- new style fields;
- new dependencies.

## Eyedropper workflow

Preferred workflow:

1. Select target object(s).
2. Click `Eyedropper`.
3. Click source object in Preview.
4. If source has same `geometricKind`, apply source style to target(s).
5. If incompatible, show status and do nothing.

Requirements:

- source click should not change selection unless existing workflow intentionally does after apply;
- one undo entry;
- geometry/layer/id/name not copied;
- coordinate anchors excluded;
- multi-selection targets supported if same geometricKind.

## Imported TikZ style shortcut

Show compact dropdown in context quick style bar if imported styles exist.

Possible label:

```text
TikZ style ▾
```

Popover:

```text
TikZ style
  None
  Recent
  Search...
  Imported
    style/key/...
```

Requirements:

- does not clutter toolbar;
- if narrow, can live under `Style…` / `More` popover;
- searchable;
- recent styles shown first;
- current selection’s style shown if applicable;
- same-geometricKind compatible application.

## Imported style + explicit override behavior

If user applies imported style:

```tex
\draw[myStyle] ...
```

Do not duplicate options already defined by the imported style just because the editor inferred them.

If the user later changes stroke width through quick bar, emit explicit override:

```tex
\draw[myStyle, line width=0.8pt] ...
```

Requirements:

- applying imported style does not automatically emit redundant color/width/opacity options;
- explicit toolbar edits after imported style become overrides;
- UI can show approximate/inferred values if available, but generation must avoid duplicate options unless overridden.

If full inferred-value tracking already exists, reuse it.

If not, implement minimal policy:

```text
Apply imported style reference.
Do not set explicit overlapping fields at the same time.
Subsequent explicit edits set explicit fields.
```

## Tests

Add tests:

1. Eyedropper button appears for curve selection.
2. Eyedropper applies curve style to curve.
3. Eyedropper rejects curve -> sheet.
4. Eyedropper applies to same-kind multi-selection.
5. Eyedropper does not copy geometry/layer/id.
6. Imported style dropdown appears when styles imported.
7. Dropdown search filters styles.
8. Recent styles shown after applying style.
9. Applying imported style emits `[styleName]` without redundant explicit options.
10. Subsequent stroke width slider edit emits `[styleName, line width=...]`.
11. Multi-selection imported style apply works atomically.
12. Coordinate anchors excluded.
13. TikZ output valid and inline output no blank lines.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Import TikZ styles.
2. Select a path; choose imported style.
3. Generate TikZ; confirm no duplicate options.
4. Change stroke width via shortcut; confirm explicit override appears.
5. Use eyedropper curve -> curve.
6. Try curve -> sheet; confirm rejected.

## Preserve existing behavior

Do not regress:

- style import;
- Inspector style editing;
- quick style bar sliders;
- style eyedropper from Phase 27D if already exists;
- TikZ generation;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- eyedropper toolbar workflow;
- imported style dropdown behavior;
- search/recent behavior;
- override/no-duplicate policy;
- same-kind validation;
- tests added/updated;
- test results;
- build results;
- limitations.
