# Phase 24B Implementation Prompt: Multi-selection state and selection UI

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
## Project context

You are working on the StratifiedTikZ project.

Phase 23 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- paths, arrows, braiding crossings, grids/lattices, sheets, ruled surfaces, Coons patches, filled regions/sheets, curved surfaces;
- symbolic variables and coordinate expressions;
- custom work planes and camera controls;
- layer palette/window;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 24 improves editing fundamentals:

1. Cursor snapping / coordinate quantization.
2. Multi-selection.
3. Bulk style/layer/delete/duplicate editing.
4. Bulk translation, including symbolic coordinates.
5. Path concatenation.
6. Layer merge and layer translation hardening.
7. Editing polish/docs/regression hardening.

Important phase decision:

- General affine transformations are **deferred to a later phase**.
- In Phase 24, the only geometric transform is translation.
- Translation must work for objects containing symbolic coordinates.
- Path concatenation does **not** need to preserve original per-path styles. The concatenated path can use a simple style policy, preferably the first selected path's style or current default curve style.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Direct/symbolic input should not be silently snapped.
- UI-only selection/draft/palette state should not be stored in `Diagram`.
- Multi-selection and operation data that affects geometry should be undoable.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, arrow/braiding behavior, SVG preview, and TikZ generation.


## Goal

Introduce multi-selection state and UI interactions in Select mode.

This subphase focuses only on selecting multiple objects and displaying a summary. Bulk edit operations are implemented in later subphases.

## Scope

Implement:

- multi-selection state model;
- Shift-click / modifier-click toggle selection;
- clear selection behavior;
- same-kind/geometric-kind policy;
- selection summary in Inspector;
- SVG highlighting for multiple selected objects;
- tests.

Do not implement yet:

- bulk style editing;
- bulk delete/duplicate;
- bulk translation;
- box/marquee selection unless small and safe;
- path concatenation;
- layer merge;
- affine transforms.

## Selection model

Add or update selection representation.

Suggested:

```ts
type Selection =
  | { kind: "none" }
  | { kind: "single"; id: string }
  | { kind: "multi"; ids: string[] };
```

If the current app uses separate `selectedElement`, adapt carefully.

Requirements:

- selection is UI/editor state;
- not stored in `Diagram`;
- supports undo/redo unaffected;
- selection ids always reference existing objects;
- stale selected ids cleaned after delete/load/layer deletion.

## Eligibility policy

MVP policy:

- multi-selection can include objects with the same `geometricKind`, e.g. all curves or all points or all sheets;
- if user tries to add a different geometric kind, either:
  - replace selection with the new object; or
  - reject/tell user only same geometric kind can be multi-selected.
- document the policy.

Do not attempt fully mixed editing in this subphase.

## Interactions

Implement:

- Click in Select mode:
  - selects one object.
- Shift-click or platform modifier click:
  - toggles object in multi-selection.
- Shift-click selected object:
  - removes it from multi-selection.
- Empty background click:
  - clears selection unless modifier policy says otherwise.
- Escape:
  - clears selection if existing keyboard handling exists.

Do not break:

- point/path/sheet selection;
- crossing marker click-to-toggle;
- geometry handle dragging;
- layer filter/visibility/lock behavior;
- preview overlay clicks.

## Inspector summary

When multi-selection is active, show a summary such as:

```text
3 curves selected
```

or:

```text
4 points selected
```

Do not show single-object fields yet unless safe.

Show at minimum:

- count;
- geometric kind;
- hint that bulk editing comes in next phases or available operations.

## SVG highlighting

Multiple selected objects should be visibly highlighted.

Requirements:

- selected highlight for all selected ids;
- handles may remain single-object only for now;
- no geometry mutation;
- filtered/hidden selected objects removed/cleaned according to existing policy.

## Tests

Add tests:

1. Single click selects object.
2. Shift-click adds same-kind object to multi-selection.
3. Shift-click selected object removes it.
4. Adding different geometric kind is rejected or resets according to chosen policy.
5. Background click clears multi-selection.
6. Deleting an object cleans selection ids.
7. Layer delete cleans selection ids.
8. Inspector summary displays correct count/kind.
9. SVG selected highlighting includes all selected ids if helper-testable.
10. Selection is not saved to JSON.
11. TikZ output unaffected by selection.

## Documentation

Document multi-selection basics and same-geometric-kind policy.

## Report after implementation

Please report:

- files modified;
- selection state model;
- modifier-click behavior;
- same-kind policy;
- inspector summary;
- highlight behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
