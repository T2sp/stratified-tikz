# ROADMAP update snippet for Phase 23

Add or replace the Phase 23 section with the following.

## Phase 23: UI refinement pass

Phase 23 refines examples, toolbar palettes, and camera UI after the major Phase 21 UI overhaul.

Recommended `phaseSlugs` entries:

```js
"23A": "example-bar-curated-layout",
"23B": "toolbar-palette-add-path-polish",
"23C": "camera-panel-below-preview",
```

### Phase 23A: Full-width Example bar and curated examples

- Make Example bar full browser width.
- Default example is Empty 2D.
- Show only:
  - Empty 2D;
  - Empty 3D;
  - 2D example;
  - 3D example;
  - braiding.
- Use the attached 2D/3D JSON examples.

### Phase 23B: Toolbar palette exclusivity and Add path menu simplification

- Only one toolbar palette can be open.
- Add path Direct input becomes one item.
- Add path buttons receive visually distinct cues.
- Fill paths visibility remains Select/Add path only.

### Phase 23C: Camera UI below Preview with slider controls

- Move camera UI below Preview and above TikZ Source.
- Add theta/phi sliders with keyboard input next to a small 3D coordinate reference.
- Add zoom/pan sliders with keyboard input.
