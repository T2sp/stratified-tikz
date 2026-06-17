# Phase 16A Implementation Prompt: Layer metadata and Layer Manager foundation

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

Phase 15 is complete. The editor has enough core geometry features to draw useful 2D/3D stratified diagrams.

Phase 16 focuses on a Layer Manager.

The app already has:

- layer values on strata and labels;
- layer-aware TikZ output;
- layer filtering;
- creation layer controls;
- selection;
- undo/redo;
- save/load;
- SVG preview;
- TikZ export;
- many geometric kinds:
  - points;
  - labels;
  - polylines;
  - cubic Béziers;
  - concatenated paths;
  - arc/circle/ellipse path templates if implemented;
  - polygon sheets;
  - filled regions;
  - work-plane-filled sheets;
  - curved sheet primitives such as hemispheres/saddles if implemented.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Layer metadata should be diagram data if it is part of saved/opened diagrams.
- Current selected layer filter and UI-expanded/collapsed state should remain UI/editor state.
- Layer operations that modify diagram elements must be undoable.
- Generated TikZ should preserve Phase 9B layer-aware output.
- Do not break save/load of older diagrams without explicit layer metadata.


## Goal

Introduce diagram-level layer metadata and a basic Layer Manager panel.

This subphase should create the foundation for later layer operations:

- rename;
- swap/reorder;
- duplicate;
- delete;
- translate;
- visibility/locking, if later implemented.

## Scope

Implement:

- layer metadata model;
- migration/default derivation from existing numeric layer values;
- save/load validation;
- basic Layer Manager UI showing layer list, names, numeric values, and element counts;
- helper functions for enumerating layers and elements per layer.

Do not implement yet:

- layer rename editing; that is Phase 16B;
- layer swap/reorder; that is Phase 16B;
- layer duplicate/delete; that is Phase 16C;
- layer translation; that is Phase 16D;
- visibility/lock controls; that is Phase 16E;
- multi-selection;
- broad UI redesign.

## Layer metadata model

Current elements already have numeric `layer` values.

Add diagram-level metadata to name/manage layers without changing that basic convention.

Suggested shape:

```ts
type LayerMetadata = {
  value: number;
  name: string;
};
```

or:

```ts
type DiagramLayerMetadata = Record<string, { name: string }>;
```

Preferred:

```ts
type DiagramLayer = {
  value: number;
  name: string;
};
```

and then:

```ts
type Diagram = {
  ...
  layers?: DiagramLayer[];
};
```

Requirements:

- existing diagrams without `layers` still load;
- missing metadata is derived from used layer values;
- layer values remain numeric;
- element `layer` fields remain the source of which layer an element belongs to;
- layer names are metadata, not replacements for numeric layer values;
- layer names are saved/loaded;
- duplicate layer values in metadata are rejected or normalized;
- non-finite layer values are rejected;
- blank layer names are rejected or replaced with safe defaults.

Suggested default names:

```text
Layer 0
Layer 1
Layer -1
```

## Layer enumeration helpers

Add pure helpers.

Suggested helpers:

```ts
getUsedLayerValues(diagram): number[]
getLayerMetadata(diagram): DiagramLayer[]
ensureLayerMetadata(diagram): Diagram
countElementsByLayer(diagram): Map<number, number>
elementsOnLayer(diagram, layerValue): ...
```

Counts should include:

- strata;
- free text labels.

If the model has future non-stratum diagram objects, exclude them unless they are rendered elements with a layer.

## Layer Manager UI foundation

Add a panel/section such as:

```text
Layer Manager
  Layer 0   value: 0   elements: 12
  Layer 1   value: 1   elements: 4
```

Requirements:

- visible enough to be useful but not disruptive;
- can be collapsible if needed;
- shows layer value;
- shows layer name;
- shows element count;
- current layer filter / selected creation layer may be shown but not changed here yet;
- UI state such as expanded/collapsed panel is not stored in `Diagram`.

## Save/load compatibility

Requirements:

- old saved diagrams without `layers` load;
- after load, metadata can be derived;
- saving a diagram with metadata preserves names;
- invalid metadata rejected safely;
- no selection/filter/UI state stored as layer metadata.

## Tests

Add focused tests:

1. Used layer values are enumerated from strata and labels.
2. Default metadata is derived for old diagrams.
3. Layer element counts include strata and labels.
4. Metadata with duplicate layer values is rejected or normalized.
5. Metadata with non-finite layer value is rejected.
6. Blank layer name rejected or replaced.
7. Save/load preserves layer names.
8. Existing diagrams without layer metadata still validate/load.
9. TikZ output remains unchanged by metadata-only addition.

## Documentation

Update docs:

- layer values remain numeric;
- layer names are diagram metadata;
- old diagrams derive default layer metadata;
- Layer Manager foundation.

## Preserve existing behavior

Do not regress:

- layer-aware TikZ output;
- layer filtering;
- creation layer;
- inspector layer editing;
- save/load old diagrams;
- SVG preview;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- metadata model chosen;
- migration/default derivation behavior;
- Layer Manager UI location;
- element counting policy;
- save/load behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
