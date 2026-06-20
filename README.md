# StratifiedTikZ

StratifiedTikZ is a browser editor for drawing stratified diagrams used in
graphical calculus for higher categories. It supports 2D and 3D diagrams,
layer-aware editing, style-aware TikZ export, symbolic coordinates, and compact
grid export.

## Development

This project currently requires a recent Node toolchain. On machines where the
default shell resolves Node 16, use Homebrew Node first:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Useful commands:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
PATH=/opt/homebrew/bin:$PATH npm run generate:tikz-examples
git diff --check
```

## Documentation

- [Specification](docs/SPEC.md)
- [Data model](docs/DATA_MODEL.md)
- [TikZ output](docs/TIKZ_OUTPUT.md)
- [Ruled surfaces](docs/RULED_SURFACES.md)
- [Symbolic input and grids](docs/SYMBOLIC_INPUT_AND_GRIDS.md)
- [Layer manager](docs/LAYER_MANAGER.md)
