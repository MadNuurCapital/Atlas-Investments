# Brand assets

## What is here

`atlas-investments-original.svg` — the file supplied by the firm.

**It is a reference, not the asset the application renders.** It is an
auto-trace of a raster image, which means:

- 80 separate paths in 80 near-identical blue shades, where the original
  artwork had one flat fill. That is JPEG compression noise, vectorised.
- An opaque white 2000 × 2000 background rectangle, so it renders as a
  white block on a dark background.
- Baked-in colours, so it cannot recolour for light and dark themes.
- 38 KB, most of it padding around a small mark.

## What the application renders

`src/components/brand/atlas-logo.tsx` — a hand-authored SVG of the same
mark. About 1 KB, scales cleanly, and recolours from the theme tokens, so
it works on a light screen, a dark screen and a printed PDF alike.

## Colours

Sampled from the supplied file. Anti-aliasing only ever blends a fill
*towards* the background, never away from it, so the most saturated blue in
the trace is closest to the true colour:

| Token | Value | Use |
| --- | --- | --- |
| Atlas Blue | `#1a6597` | Mark, wordmark, primary actions, links |
| Atlas Blue (dark mode) | `#4a8fc2` | Same, stepped up so it stays legible |
| Atlas Gold | `#f6de6b` | Brand accent only — never a status colour |

All defined in `src/app/globals.css`. Changing the palette is a one-file edit.

## If a clean original turns up

A vector original — from the designer's source file rather than a trace —
would be worth having. Two flat fills instead of eighty, no background
rectangle, tight bounds. Drop it in here, resample the two hex values above,
and correct the geometry in `atlas-logo.tsx` if it differs.
