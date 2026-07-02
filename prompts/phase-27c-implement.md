# Phase 27C Implementation Prompt: Path splitting at an interior point

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

The editor now has mature core editing features:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- coordinate anchors and coordinate references;
- symbolic variables;
- global and work-plane-local symbolic coordinates;
- cursor snapping;
- multi-selection and bulk editing;
- symbolic-aware translation;
- path concatenation;
- layer merge/translation;
- custom work planes and camera controls;
- paths with arrows;
- 2D braiding/string-diagram crossings;
- grids/lattices;
- points, labels, paths, sheets, filled regions/sheets, ruled surfaces, Coons patches, and curved surfaces;
- layer palette/window;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 27 is an interaction/editing polish phase.

Prioritized features:

1. Selection cycling for overlapping objects.
2. Path inline nodes/vertices exported as `node[pos=..., ...]` on paths.
3. Path splitting at an interior point.
4. Style eyedropper between objects with the same `geometricKind`.
5. UI polish:
   - make the Layer window Actions popover/panel semi-transparent and easier to understand;
   - change Inspector numeric inputs to allow temporarily invalid text and show warnings instead of blocking input, so values like `.5` are easy to type;
   - rename Add path `Line/manual path` to something clearer like `Arbitrary path`.

Important conventions:

- UI-only state must not be stored in `Diagram`.
- Anything affecting exported TikZ must be persisted.
- Selection/cycling state is UI-only.
- Path inline nodes/vertices affect TikZ and must be persisted.
- Path split creates or updates geometry and must be undoable.
- Style eyedropper changes style only, not geometry.
- Inline math TikZ output must contain no blank lines.
- TikZ indentation remains 4 spaces.
- Preserve save/load, undo/redo, SVG preview, TikZ export, symbolic input, work-plane-local coordinates, coordinate anchors, layer manager, arrows, braiding, and existing geometry behavior.


## Goal

Implement splitting a path at an interior point into two paths.

This is distinct from Phase 27B path inline nodes: splitting changes geometry and creates two path objects.

## Scope

Implement:

- split-point selection on path;
- split helpers for supported segment kinds;
- UI command;
- optional keep-original behavior;
- crossing/inline-node/arrow handling policy;
- tests.

Do not implement:

- general topological graph editing;
- arbitrary curve intersection splitting;
- new segment types;
- advanced Bezier smoothing.

## Supported split targets

Support at minimum:

- polyline / line segment;
- concatenated path line segment;
- cubic Bézier segment via De Casteljau;
- arc segment if exact split is practical;
- otherwise reject unsupported segments clearly.

Path templates:

- circle/ellipse templates may be rejected for MVP or converted to path segments if existing helper supports it.

## UI

Workflow:

1. Select a path.
2. Choose `Split path`.
3. Click a point on the path or enter:
   - segment index;
   - pos between 0 and 1.
4. Create two paths.

Options:

```text
Keep original path: off/on
```

Recommended default:

- off, because split convention usually replaces original with two parts.
- If consistency with path concatenation suggests non-destructive default, choose and document.

## Geometry semantics

Split at segment-local `t`.

### Line

```text
A -- B
=> A -- P
   P -- B
```

### Cubic Bézier

Use De Casteljau.

```text
P0, C1, C2, P3
=> left cubic and right cubic
```

### Arc

If supported:

- split angle/parameter at t;
- preserve center/frame/radius;
- create two arc segments.

If not supported:

- reject with clear message.

## Metadata policy

### Styles

Simple policy:

- both resulting paths inherit original path style.
- segment-level styles preserved only where already local to kept segments.
- no need to invent complex style mapping.

### Arrows

Preferred:

- first path inherits backward/start arrow semantics;
- second path inherits forward/end arrow semantics;
- mid-arrow decorations are either:
  - assigned to the side containing the original mid position; or
  - removed with a clear documented policy.

MVP acceptable:
- both split paths inherit no mid-arrow, endpoint arrows adjusted conservatively.
- Must test/document.

### Inline nodes from Phase 27B

If original path has inline nodes:

- nodes before split go to first path;
- nodes after split go to second path;
- node at split point policy documented.

### Braiding/crossings

Path ID changes can make crossings stale.

MVP:

- remove crossing states involving the original path;
- do not transfer them to split paths.

### Coordinate refs

Preserve coordinate refs on original endpoints/controls where possible.

The new split point may be numeric/global preview unless user picks an existing coordinate anchor.

## Tests

Add tests:

1. Split line segment.
2. Split polyline interior segment.
3. Split cubic via De Casteljau.
4. Arc split if supported, or rejection if unsupported.
5. Unsupported template split rejected cleanly.
6. Source path removed/kept according to option.
7. New paths get unique ids.
8. Style policy applied.
9. CoordinateRef endpoints preserved.
10. Split point finite.
11. Inline nodes redistributed if Phase 27B exists.
12. Crossing states involving original path cleaned.
13. Undo/redo works.
14. TikZ output valid for both paths.
15. Inline output no blank lines.

## Report after implementation

Please report:

- files modified;
- split UI workflow;
- supported segment kinds;
- unsupported segment policy;
- style/arrow/inline-node/crossing policy;
- keep-original behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
