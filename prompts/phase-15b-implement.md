# Phase 15B Implementation Prompt: Create filled regions/sheets from selected closed paths

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

Phase 14 is complete or near complete.

The project goal includes efficiently drawing 2D and 3D stratified diagrams with:

- closed paths;
- filled regions/sheets;
- translucent colored 2-dimensional strata;
- solid and dotted 1-strata;
- point markers;
- labels;
- coordinate axes;
- readable TikZ output.

Phase 15 now prioritizes closed-path filling in both 2D and 3D before more specialized curved surface primitives.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- In 2D:
  - codim 0 strata are regions;
  - codim 1 strata are curves;
  - codim 2 strata are points.
- In 3D:
  - codim 1 strata are sheets;
  - codim 2 strata are curves;
  - codim 3 strata are points.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work planes are model-space editing aids.
- A 3D closed-path filled sheet in this phase should be planar and work-plane-local.
- Preview-only UI state should not be stored in `Diagram`.
- Generated TikZ must remain readable and should preserve style/layer semantics.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load, undo/redo, camera, work-plane, concatenated path, and existing creation/editing behavior.


## Goal

Implement creation of filled objects from selected closed paths.

This phase should let users select one or more closed paths and create:

1. a 2D filled region in 2D diagrams;
2. a 3D work-plane-local filled sheet in 3D diagrams.

For multiple selected closed paths, support `evenOdd` fill rule so nested paths can describe holes.

## Prerequisites

Phase 15A is complete.

Phase 14 concatenated paths exist and can represent closed line/cubic paths.

## Scope

Implement:

- creation command from selected closed paths;
- multiple-boundary selection;
- fill rule selector, especially `evenOdd`;
- copy-on-create boundary behavior;
- selection of created filled object;
- undo/redo integration.

Do not implement yet:

- SVG/TikZ rendering if not already done; that is Phase 15C;
- editing UI; that is Phase 15D;
- curved surface primitives;
- boolean operations;
- live linked boundary references;
- broad multi-selection features beyond what is needed to select paths for fill creation.

## Selection / input workflow

Add a UI action such as:

```text
Create filled region/sheet from selected closed paths
```

or:

```text
Fill selected closed paths
```

MVP workflow:

- user selects one or more closed concatenated path strata;
- chooses fill rule:
  - nonzero;
  - evenOdd;
- clicks Create Fill.

If multi-selection is not broadly implemented, add a minimal path-picking workflow:

```text
Pick boundaries for fill
Picked 0 paths
[Pick path] [Reset] [Cancel] [Create fill]
```

The workflow may be local to this feature and should not require full Phase 17 multi-selection.

## 2D behavior

In a 2D diagram:

- selected closed paths must lie in 2D with `z = 0`;
- create a codim-0 `filledRegion` stratum;
- copy path boundary segments into the region;
- do not live-link to source paths;
- created region uses RegionStyle defaults;
- created region is selected after creation.

## 3D behavior

In a 3D diagram:

- selected closed paths must lie on one common work plane / plane frame;
- if paths have work-plane-local metadata, reuse or derive the plane frame;
- otherwise compute/validate a plane from boundary points when reliable;
- all selected boundaries must be coplanar within tolerance;
- create a codim-1 `workPlaneFilledSheet` stratum;
- copy path boundary segments into the sheet;
- do not live-link to source paths;
- created sheet is selected after creation.

Important:

- This is a 2D-like fill on a 3D work plane.
- Do not create non-planar surface filling in this subphase.
- If selected paths are not coplanar, reject with a clear message.

## Multiple boundaries and even-odd fill

Support multiple closed paths.

Required:

- `fillRule: "evenOdd"` can be selected;
- all selected boundaries are stored in order;
- the filled object stores all boundaries;
- boundaries are copied at creation time;
- source paths remain unchanged.

Even-odd semantics will be used by SVG/TikZ rendering in later/current subphase.

If fill rendering is not yet implemented, still store `fillRule` correctly.

## Validation

Before creation:

- every selected source is a closed path;
- no source path is open;
- every segment finite;
- 2D/3D ambient dimension matches;
- 3D sources are coplanar;
- no duplicate source path IDs unless explicitly allowed;
- fill rule valid.

Invalid selection must not modify diagram.

## Tests

Add focused tests:

1. Create 2D filled region from one selected closed path.
2. Create 2D filled region from two selected closed paths with `evenOdd`.
3. Open path rejected.
4. Non-finite path rejected.
5. Create 3D work-plane-filled sheet from one closed path on active/work plane.
6. Create 3D work-plane-filled sheet from two coplanar closed paths with `evenOdd`.
7. Non-coplanar 3D selected paths rejected.
8. Boundaries are copied, not live-linked.
9. Moving source path after creation does not change filled object.
10. Created filled object selected.
11. Undo/redo creation if testable.
12. Source paths remain unchanged.

## Documentation

Document:

- create fill from selected closed paths;
- copy-on-create;
- multiple boundaries;
- even-odd rule;
- 3D fill is planar/work-plane-local.

## Preserve existing behavior

Do not regress:

- concatenated path selection/editing;
- existing regions/sheets;
- save/load;
- undo/redo;
- SVG/TikZ output for existing objects.

## Report after implementation

Please report:

- files modified;
- UI workflow;
- 2D creation behavior;
- 3D work-plane/coplanarity behavior;
- fill rule selection;
- copy-on-create policy;
- tests added/updated;
- test results;
- build results;
- limitations.
