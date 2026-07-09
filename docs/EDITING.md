# Editing Fundamentals

The editor keeps geometry-changing behavior in `Diagram` data and keeps
transient interaction state outside saved JSON. Selection state, cycling state,
inspector disclosure, draft geometry, and layer filters are UI/editor state.

## Cursor Snap

Cursor snap is an editor preference, not diagram data. It applies only when a
screen/cursor action produces a model coordinate:

- cursor point and label placement;
- cursor path and sheet draft vertices;
- geometry-handle dragging.

Direct numeric input, symbolic expression input, JSON load, programmatic model
updates, and TikZ generation are never silently snapped.

The built-in snap presets are:

```text
1, 0.5, 0.1, 0.01, 0.001
```

The custom step must be finite and positive. In 2D mode, snap rounds cursor
`x` and `y` values and keeps `z = 0`. In 3D mode, snap rounds coordinates in
the active work-plane local `(a, b)` coordinates, then reconstructs the
ordinary model-space `Vec3`.

## Multi-Selection

Modifier-click toggles objects in the selection. The MVP policy allows bulk
selection only for objects with the same `geometricKind`; clicking a different
kind replaces the selection. This keeps bulk style and arrow controls
predictable.

Alt-click, or Option-click on macOS, cycles through overlapping selectable
objects under the cursor. Cycling is UI-only state: the saved diagram does not
store the cycle index or the last cursor position. The cycle can include
coordinate anchors, labels, strata, path crossing markers, path inline nodes,
curves, sheets, and regions. Path inline nodes select their owning path because
the node is persisted as path data rather than as a standalone diagram element.

Coordinate anchors have their own coordinate-only multi-selection family.
Modifier-clicking coordinates can build a coordinate selection, but coordinates
and layer-bound objects are not mixed for MVP translation. Coordinate anchors
are global live TikZ references, while layer-bound objects carry layer, locking,
filter, style, and detach-on-layer-translation semantics.

Selection, selection highlights, inspector disclosure state, draft geometry,
and layer filter state are UI/editor state. They are not fields of `Diagram`
and are not saved.

## Bulk Editing

Bulk style edits apply to the selected objects of the same geometric kind.
Common values are shown directly; mixed values are shown as `Mixed`. Editing a
mixed field applies the new explicit value to every selected object. Explicit
style edits from the Inspector, bulk editor, or Preview quick style bar are
treated as user overrides. They clear local `stylePresetId` values, because the
object is no longer exactly following that local preset.

Imported TikZ style references are preserved when possible. If an object uses an
imported TikZ style and the user changes an explicit field such as stroke width,
the saved object keeps its `importedTikzStyleReferenceId`; generated TikZ keeps
the imported style reference and emits the explicit override after it, for
example:

```tex
\draw[myImportedStyle, line width=0.8pt] ...
```

This keeps generated TikZ compact while making user overrides visible. The
generator avoids duplicating options already provided by the imported style
unless the user explicitly overrides those fields. The Preview quick style bar's
explicit clear-style command intentionally clears both `stylePresetId` and
`importedTikzStyleReferenceId`, because that command removes the selected style
reference rather than editing one style field.

Bulk layer changes, duplicate, delete, and translation are undoable diagram
edits. Duplicate assigns fresh top-level IDs and fresh nested IDs where needed.
Delete clears the selection and removes stale path crossing states that
referenced deleted curves.

## Symbolic Translation

Translation is the only Phase 24 geometric transform. General affine
transforms, including rotate, scale, and shear, are deferred.

Translation fields accept numeric values or scalar expressions using declared
diagram variables. If either the source coordinate or the translation delta is
symbolic, the translated coordinate stores a new symbolic addition expression
and a refreshed finite preview value. In 2D, `z` remains numeric `0`.

Translation moves absolute coordinates and frame origins. It does not rotate or
scale frame basis vectors, relative/local control metadata, or sheet parameter
directions.

For a coordinate stored with a `workPlaneLocal` source,
`P = frame.origin + a*u + b*v`, global translation moves that coordinate's own
stored frame snapshot origin by the global vector and leaves `a`, `b`, `u`,
`v`, and `normal` unchanged. The active work plane is not a live reference and
is never mutated by translation; each saved coordinate/frame snapshot is copied
and moved as diagram data. This keeps local symbolic expressions available for
TikZ plane-scope export after translation.

Coordinate-anchor translation uses the same symbolic addition rules for global
positions. It moves the selected coordinate anchors themselves, so existing
`coordinateRef` sources in paths, sheets, points, and free text labels remain
live and follow the moved anchors. If a selected anchor's own stored position
contains an internal `coordinateRef`, that internal reference is detached before
translation. Direct Inspector coordinate translation does not use cursor snap;
dragging a selected coordinate marker translates the selected coordinate group
through cursor input, so snap applies to the dragged target point.

## Path Concatenation

Path concatenation joins selected path-like curves in selection order. The next
source path may be auto-reversed when its end, rather than its start, matches
the current endpoint. Non-composable endpoint mismatches are rejected without
mutation.

The generated concatenated path uses the first selected path's style, arrows,
and layer. Later source-path styles and segment overrides are intentionally not
preserved in Phase 24. The user may keep the original paths or remove them; if
the originals are removed, stale crossing states are cleaned.

When source path coordinates carry work-plane-local symbolic metadata,
concatenation clones that metadata with the segment coordinates. Same-frame
local coordinates remain eligible for local TikZ plane-scope export. Mixed-frame
local coordinates are not expanded into global symbolic formulas; TikZ export
falls back to finite preview coordinates with a policy comment.

## Layer Merge And Translation

Layer merge moves all strata and free text labels from an existing source layer
to an existing target layer, removes source metadata, and preserves target
metadata. If the target layer is hidden or locked, operation status warns that
moved objects may become hidden or unavailable for ordinary editing.

Layer translation reuses the same symbolic-aware translation engine as bulk
selection translation. It moves every absolute coordinate on the layer,
including paths, labels, filled boundaries, grids, ruled surfaces, Coons patch
snapshots, and frame origins.

Before layer translation, supported coordinate references on layer-bound
objects are detached. This differs from coordinate-anchor translation, where the
anchors move and references intentionally remain live.

## Regression Guardrails

Phase 24 regression tests cover combined workflows rather than only isolated
helpers:

- snap plus cursor path creation;
- multi-select style edits plus TikZ export;
- duplicate/delete plus undo/redo;
- symbolic translation plus save/load;
- path concatenation plus arrows and braiding cleanup;
- layer merge plus layer translation plus TikZ export;
- coordinate multi-selection translation plus save/load, snap drag, undo/redo,
  and TikZ export;
- inline math export with no blank lines after edits;
- selection/editor state excluded from saved JSON.

Bulk operations build ID lookup maps before scanning selected objects so large
multi-selections stay linear in diagram size. Visibility and projected sorting
still use their existing sample-count caps.

## Style Eyedropper

The Inspector style controls include copy/paste style commands. Copy reads the
explicit saved style from one selected stratum or free text label. Paste applies
that style only to selected targets with the same `geometricKind`; mixed-kind
target selections fail without partial mutation.

For curves, the copied style includes path arrow options. Pasting a curve style
to multiple selected curves updates their style and arrows but leaves geometry,
layer membership, inline nodes, labels, and path crossing state unchanged. Style
copy state is UI-only; only successful paste results are diagram edits and are
therefore undoable, redoable, saved, and exported.

## Inspector Numeric Editing

Inspector numeric fields are lenient while the user is typing. Temporary drafts
such as `.`, `-`, or `1e` remain visible in the field and show a warning instead
of immediately overwriting the saved value. Valid drafts, including leading
decimals such as `.5`, commit normally.

TikZ export always uses the last committed diagram value. Invalid temporary
Inspector text is not stored in `Diagram`, is not saved, and cannot affect
generated TikZ.

## Path Inline Nodes

Path inline nodes are segment-local annotations persisted on curve strata and
exported as TikZ `node[pos=...]` attachments. They do not split path geometry.
The text is raw user text; the editor does not add `$...$`.

For a path segment from `A` to `B`, an inline node with position `0.5` and
placement `above` exports as:

```tex
(A) -- node[pos=0.5, above] {$f$} (B)
```

Inline nodes are shown in the preview and can participate in selection cycling,
but selecting one selects the owning path for editing.

## Path Splitting

The path split control is available for splittable curve paths. A split target
uses a one-based segment number in the UI and a position satisfying
`0 < pos < 1`. The edit creates two path strata, adjusts endpoint arrows, drops
whole-path mid-arrow decorations, redistributes inline nodes away from the split
point, and cleans stale crossing states when the original path is removed.

Splitting is atomic. Unsupported path kinds, invalid segment numbers, invalid
positions, non-finite preview coordinates, and unsupported segment geometry fail
without changing the diagram. Successful splits are one undoable diagram edit.

## Arbitrary Path Naming

The Add path cursor tool named `Arbitrary path` creates a path from line, arc,
and cubic Bezier segments. Direct path input still exposes specific template
modes such as circle, ellipse, and arc.
