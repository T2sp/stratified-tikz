# Phase 23A Implementation Prompt: Full-width Example bar and curated examples

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

Phase 22 is complete or near complete.

The editor now supports:

- preview-centered UI;
- floating toolbar inside SVG/PGF Preview;
- direct input drawer;
- inspector drawer;
- layer palette/window;
- camera controls;
- examples and JSON load/save;
- 2D/3D diagrams;
- paths with arrows;
- braiding/string-diagram crossings;
- custom work planes;
- symbolic variables;
- grids/lattices;
- sheets, filled regions/sheets, curved surfaces, ruled surfaces, Coons patches;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math output with no blank lines;
- save/load;
- undo/redo.

Phase 23 is a UI refinement phase.

The user wants three groups of changes:

1. Example bar placement and content.
2. Toolbar palette behavior and Add path menu simplification.
3. Camera UI relocation below the Preview and slider-based controls.

Important constraints:

- This is primarily UI/layout work.
- Do not change diagram geometry semantics.
- Do not change TikZ generation semantics unless required by an example asset integration.
- UI open/closed state should remain editor/UI state, not diagram data.
- Preserve all existing creation/editing behavior.
- Preserve save/load, undo/redo, SVG preview, TikZ source generation, camera/work-plane/layer/style/variable/grid/braiding behavior.


## Goal

Refine the Example bar so it spans the full browser width, does not require horizontal scrolling, and exposes only the curated examples requested by the user.

## User requirements

- The Example bar should take the full browser width.
- It should not require scrolling.
- The default displayed example should be `Empty 2D`.
- `Empty 2D` and `Empty 3D` should be placed at the far left, in this order.
- The only examples besides empty examples should be:
  - `2D example`;
  - `3D example`;
  - `braiding`.
- `2D example` and `3D example` should correspond to the attached JSON files:
  - `assets/2d-example.json`;
  - `assets/3d-example.json`.

## Assets

This prompt archive includes:

```text
assets/2d-example.json
assets/3d-example.json
```

Copy them into an appropriate project location before or during implementation, for example:

```text
src/examples/2d-example.json
src/examples/3d-example.json
```

or encode them as TypeScript fixtures if that matches existing architecture.

If the repository already has an example fixture convention, follow it.

## Scope

Implement:

- full-width Example bar layout;
- curated example list;
- default example = Empty 2D;
- integration of the attached 2D/3D JSON examples;
- preserve or update braiding example;
- tests.

Do not implement:

- broad UI redesign beyond the Example bar;
- new geometry features;
- new TikZ export behavior;
- new example categories beyond requested list;
- new dependencies.

## Example list

The final Example bar should present:

```text
Empty 2D
Empty 3D
2D example
3D example
braiding
```

Requirements:

- `Empty 2D` is first and selected by default.
- `Empty 3D` is second.
- `2D example`, `3D example`, and `braiding` follow.
- Remove/hide older extra examples from the main bar.
- Do not duplicate example names.
- Example switching should still reset temporary edits according to existing example behavior.

## Layout

Requirements:

- bar spans the full width of the browser content area.
- bar fits without horizontal scroll at typical desktop widths.
- buttons may compress, wrap to a second row, or use responsive sizing, but horizontal scrolling should not be required.
- current top compact controls should not overlap the Example bar.
- on narrow screens, wrapping is acceptable.

Suggested CSS:

```css
.example-bar {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
}
```

Avoid:

- fixed-width container that clips examples;
- horizontal overflow scroll for the Example bar;
- example buttons hidden behind other controls.

## Example asset validation

The attached JSON examples should be validated through existing load/normalization logic.

Requirements:

- `2D example` loads without errors.
- `3D example` loads without errors.
- symbolic variables, custom styles, arrow/braiding/surface data in examples should be handled by existing load pipeline.
- if examples contain user state not appropriate for a fixture, sanitize minimally while preserving diagram geometry.

If the attached file uses exported/saved format, prefer importing it through existing `parseSavedDiagramJson` fixture path.

## Tests

Add focused tests:

1. Example list contains exactly `Empty 2D`, `Empty 3D`, `2D example`, `3D example`, `braiding`.
2. `Empty 2D` is default.
3. `Empty 2D` appears before `Empty 3D`.
4. `2D example` fixture loads successfully.
5. `3D example` fixture loads successfully.
6. Braiding example still loads successfully.
7. Example bar has no required horizontal scroll in layout helper/component if testable.
8. Switching examples still resets temporary edits according to existing policy.

If component/CSS tests are limited, test example registry and fixture loading.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Example bar spans full width.
2. No horizontal scroll is needed for the Example bar.
3. `Empty 2D` is selected by default.
4. `Empty 2D` and `Empty 3D` are the first two buttons on the left.
5. Only five examples are visible:
   - Empty 2D;
   - Empty 3D;
   - 2D example;
   - 3D example;
   - braiding.
6. Click `2D example`; it loads.
7. Click `3D example`; it loads.
8. Click `braiding`; it loads.
9. Resize the browser and confirm wrapping/fit remains usable.

## Preserve existing behavior

Do not regress:

- JSON load/save;
- example switching reset policy;
- SVG Preview;
- toolbar overlays;
- Inspector/Layer/Camera panels;
- TikZ source;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- where example assets were placed;
- final example list/order;
- default example behavior;
- Example bar layout/CSS strategy;
- tests added/updated;
- test results;
- build results;
- limitations.
