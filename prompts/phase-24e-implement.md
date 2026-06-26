# Phase 24E Implementation Prompt: Concatenate selected paths

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

Implement concatenation of multiple selected paths.

Users should be able to select several path-like objects and create a new concatenated path from them.

The original paths can be preserved or removed according to user choice.

Important phase decision:

- The concatenated path does **not** need to preserve the original styles of all source paths.
- Use a simple style policy, preferably:
  - new path uses the first selected path's style; or
  - new path uses current/default curve style.

## Prerequisites

Multi-selection from Phase 24B is complete. Bulk operations may be complete but are not strictly required.

## Scope

Implement:

- path concatenation helper;
- UI action for selected paths;
- endpoint compatibility and auto-reversal;
- keep-originals option;
- undo/redo;
- tests.

Do not implement:

- preserving per-source styles;
- advanced path ordering UI;
- automatic graph path finding;
- braiding state transfer;
- new path geometry types;
- affine transforms.

## Eligible paths

Support concatenating:

- polylines;
- concatenated paths;
- line/cubic/arc segments;
- path templates if they can be converted to path segments safely.

If a kind is unsupported:

- reject with clear message;
- do not partially create a path.

## Ordering policy

MVP ordering:

- use current multi-selection order.

Requirements:

- preserve selection order if multi-selection state tracks it;
- if selection order is unavailable, use deterministic order and document it.

## Endpoint connection and auto-reverse

For selected paths in order:

1. Start with first path as chosen.
2. For each next path:
   - if current end matches next start, append as-is;
   - if current end matches next end, append reversed next path;
   - otherwise reject.

Use existing tolerance.

Do not mutate source paths.

If first path orientation prevents connection but reversing first would help, MVP may reject. Optional improvement: try reversing the whole chain if simple.

## Keep originals option

UI option:

```text
Keep original paths: on/off
```

Preferred default:

```text
on
```

If off:

- remove source paths after creating concatenated path;
- clean dependent crossing states for removed paths;
- select new concatenated path;
- undo/redo restores all.

If on:

- source paths remain;
- crossing states on source paths remain;
- new path starts with no crossing states.

## Style policy

No need to preserve original source styles.

Choose one simple policy:

### Preferred

- new path uses style/arrows/layer of the first selected path.

### Alternative

- new path uses current default curve style and current new-element layer.

Document and test the chosen policy.

Do not create segment-level style overrides just to preserve source path styles.

Arrow options:

- either inherit from first selected path or default no arrows, according to chosen style policy.
- Do not attempt to merge multiple source arrow settings.

## Symbolic coordinates

Preserve symbolic coordinates/expressions in appended segments.

Requirements:

- no conversion to preview numbers when unnecessary;
- reversed symbolic segments preserve expressions;
- preview values finite;
- TikZ export works.

## Tests

Add tests:

1. Concatenate two connected line paths.
2. Concatenate three connected paths.
3. Auto-reverse next path when endpoint matches its end.
4. Reject non-connected paths.
5. Source paths unchanged when keep originals on.
6. Source paths removed when keep originals off.
7. New path selected.
8. New ids generated.
9. Style policy tested: first path style/default style.
10. Original styles of later paths are not preserved as segment overrides.
11. Symbolic coordinates preserved.
12. Crossing states cleaned when originals removed.
13. Undo/redo works.
14. TikZ output for concatenated path valid.

## Documentation

Document ordering, auto-reverse, keep-originals, and style policy.

## Report after implementation

Please report:

- files modified;
- eligible path kinds;
- ordering policy;
- auto-reverse behavior;
- keep-originals behavior;
- style policy;
- symbolic coordinate handling;
- tests added/updated;
- test results;
- build results;
- limitations.
