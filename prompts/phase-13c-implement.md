# Phase 13C Implementation Prompt: Work-plane toolbar reorganization

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


## Project context

You are working on the StratifiedTikZ project.

Phase 12 is complete.

The app now has:

- 2D and 3D diagrams;
- cursor creation and direct creation;
- custom work planes;
- work-plane-local Bézier support;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- selection, inspector, layer filtering, and style editing.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- UI/editor state should not be stored in `Diagram`.
- Preview-only guides and highlights should not be exported to TikZ unless explicitly requested by an export option.
- Generated TikZ must remain readable and should not include selection/editor-only state.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load and undo/redo behavior.


## Goal

Reorganize the work-plane toolbar/control area so it is readable and not visually crowded.

The current work-plane controls can become a dense block containing preset selection, origin+normal inputs, three-point inputs, point-picking controls, apply/reset/cancel buttons, and status. This should be reorganized using grouping, wrapping, and collapsible sections.

## Scope

Implement UI/CSS/layout improvements for work-plane controls.

Do not implement:

- new work-plane features;
- new geometry;
- full camera controls;
- layer manager;
- multi-selection;
- broad app redesign;
- new dependencies.

Do not change:

- work-plane geometry;
- active work-plane semantics;
- cursor/direct creation behavior;
- TikZ export;
- save/load format.

## Required layout

Organize work-plane controls into a clear section.

Recommended structure:

```text
Work plane ▸ xy plane at z = 0

When expanded:

Preset
  [xy / xz / yz / custom] [fixed value]

Custom by origin + normal
  Origin: x y z
  Normal: x y z
  [Apply]

Custom by 3 points
  P0: x y z
  P1: x y z
  P2: x y z
  [Apply]

Pick 3 existing points
  Picked 0/3
  [Pick points] [Reset] [Cancel] [Apply]
```

Requirements:

- compact summary visible in 3D;
- details collapsible;
- controls grouped by purpose;
- numeric inputs aligned consistently;
- buttons placed near the fields they affect;
- disabled buttons visually clear but not dominant;
- work-plane controls hidden/minimized in 2D;
- wrapping works on narrower windows;
- no controls overlap;
- no large stranded blocks.

## Top-level toolbar grouping

If necessary, group broader top-level controls:

- Project / Example / File;
- History;
- Creation tool / input mode / new element layer;
- Layer filter / selection;
- Work plane.

Do not overbuild a full design system.

## Tests

Mostly CSS/layout; tests optional.

If pure helpers are added, test:

- work-plane details expanded/collapsed state;
- 2D mode hides/minimizes work-plane section;
- 3D mode shows active work-plane summary.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open 3D diagram.
2. Work-plane section is compact by default.
3. Expand work-plane details.
4. Origin+normal fields are readable.
5. Three-point fields are readable.
6. Pick 3 points controls are readable.
7. Switch xy/xz/yz/custom.
8. Existing work-plane behavior still works.
9. Switch to 2D diagram.
10. Work-plane controls are hidden/minimized.
11. Resize browser narrower.
12. Controls wrap cleanly without overlap.

## Preserve existing behavior

Do not regress:

- custom work-plane creation;
- axis-aligned work planes;
- work-plane preview;
- cursor/direct creation;
- point picking for work plane;
- save/load;
- undo/redo;
- SVG/TikZ output.

## Report after implementation

Please report:

- files modified;
- layout structure changes;
- how work-plane controls are grouped;
- collapse/expand behavior;
- 2D behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
