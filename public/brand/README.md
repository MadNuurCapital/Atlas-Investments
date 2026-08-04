# Brand assets

Place the official Atlas Investments logo files here:

- `atlas-investments.svg` — preferred, vector
- `atlas-investments.png` — acceptable, transparent background

## Current status

The application currently renders the mark from a hand-authored SVG in
`src/components/brand/atlas-logo.tsx`, built to match the supplied artwork.
It scales cleanly, recolours for light and dark themes, and adds about 1KB
to the page instead of a raster download.

Once the official file is committed here, compare the two side by side. If
the reproduction is faithful, keep it — a themeable vector component is the
better asset. If it differs, the component's geometry is a handful of
rectangles and one path and is quick to correct.

Brand colours live in `src/app/globals.css` under `:root`. Replacing the
palette is a single-file change.
