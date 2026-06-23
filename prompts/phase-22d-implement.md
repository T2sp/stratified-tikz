# Phase 22D Implementation Prompt: Braiding crossing state and click-to-toggle UI

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

Phase 21 is complete.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- paths, path templates, arc/circle/ellipse, sheets, filled regions/sheets, ruled surfaces, Coons patches, curved surfaces;
- symbolic variables and coordinate expressions;
- grid/lattice generation;
- custom work planes;
- camera controls;
- layer manager;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo;
- SVG preview and TikZ generation.

Phase 22 adds:

1. Arrow options for 2D and 3D paths.
2. Mid-segment arrow decorations, similar to TikZ `decorations.markings`.
3. Path direction reversal.
4. 2D-only braided monoidal category string-diagram crossing controls:
   - detect path intersections;
   - click an intersection to toggle:
     - no braiding;
     - braiding;
     - anti-braiding;
   - avoid relying on the TikZ `knot` package because it tends to conflict with decorations.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- UI overlay/draft state should not be stored in `Diagram`.
- Arrow/braiding data that affects TikZ output should be persisted.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- TikZ indentation must remain 4 spaces.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, and all existing geometry behavior.


## Goal

Add persistent 2D crossing states for braided monoidal category string diagrams, and let users click crossing candidates to cycle:

```text
no braiding -> braiding -> anti-braiding -> no braiding
```

This subphase handles model and SVG interaction. TikZ export masking/gap output is Phase 22E.

## Prerequisites

Phase 22C is complete.

## Scope

Implement:

- crossing state model;
- click-to-toggle behavior;
- SVG preview differences for no/braid/anti;
- persistence/save-load;
- tests.

Do not implement:

- final TikZ no-knot export; Phase 22E;
- exact intersection splitting;
- 3D braiding;
- knot package usage.

## Crossing state model

Add persistent diagram data or export decoration data.

Suggested:

```ts
type CrossingKind = "none" | "braiding" | "antiBraiding";

type PathCrossingState = {
  id: string;
  pathAId: string;
  pathBId: string;
  point: Vec3; // z=0 preview point
  parameterA: number;
  parameterB: number;
  kind: CrossingKind;
};
```

Requirements:

- affects SVG/TikZ output, so persisted;
- old diagrams load with no crossings;
- invalid path references rejected or ignored safely;
- if path geometry changes and crossing no longer exists, state is invalidated or shown stale according to a clear policy.

## Toggle UI

Clicking a crossing marker cycles:

```text
none -> braiding -> antiBraiding -> none
```

Requirements:

- works only in 2D;
- does not toggle in 3D;
- does not interfere with normal path selection too much;
- status message shows current state.

## Meaning of braiding/anti-braiding

Define a deterministic convention.

Preferred MVP:

- `braiding`: pathA passes over pathB.
- `antiBraiding`: pathB passes over pathA.
- `none`: draw normally, no gap/mask.

Where `pathA/pathB` are deterministically assigned by candidate ID/order.

Document this clearly.

Alternative:

- use oriented tangent sign to assign positive/negative braid.
- If implemented, test carefully.

## SVG preview

For Phase 22D, a simple preview is acceptable:

- marker color/style changes by state;
- optional local gap/mask preview if simple.

Full gap rendering is Phase 22E.

Requirements:

- no TikZ export change yet unless simple;
- preview markers not saved as separate geometry;
- crossing states saved.

## Tests

Add tests:

1. Toggling candidate cycles none/braiding/anti/none.
2. Crossing state saves/loads.
3. Invalid referenced path rejected/cleaned.
4. Candidate pathA/pathB deterministic.
5. 3D diagram cannot create crossing state.
6. SVG marker style differs by state if helper-testable.
7. Existing selection behavior not broken.

## Documentation

Document braiding state convention.

## Report after implementation

Please report:

- files modified;
- crossing state model;
- toggle behavior;
- pathA/pathB convention;
- SVG preview behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
