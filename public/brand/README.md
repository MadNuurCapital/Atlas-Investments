# Brand assets

## What the application renders

`atlas-logo.png` — **1306 × 376**, transparent background. The firm's own
artwork, derived from the supplied export.

Rendered by `src/components/brand/atlas-logo.tsx`.

## How it was derived, and why not by hand

The supplied file is 4000 × 4000, colour type 2 (RGB) — **no alpha
channel**. Almost all of it is empty white space around a small mark, so at
a header height the mark itself would come out a few pixels tall.

Two things had to happen: key out the white, and crop to the real content.

The naive way to do the first — "make every white pixel transparent" —
would punch a hole straight through the white square **inside** the mark.
So the background is removed by flooding inwards from the image border and
clearing only the pixels the flood can reach. The mark's interior white is
enclosed by blue, the flood never gets there, and it stays opaque.

The gold accent square survives for a different reason: the test is
distance-to-white in RGB, not luminance. Gold is a *light* colour
(luminance ≈ 216 of 255) and a luminance test would have eaten it, but its
blue channel is 107, putting it 148 away from white — far outside the
threshold of 48.

The crop is then computed from what is left, not guessed.

Both steps live in `scripts/build-logo.mjs`. The output is committed, so a
normal build never runs it. When the firm sends a new export, replace
`atlas-logo-source.png` and run:

```bash
node scripts/build-logo.mjs
```

It prints the source and cropped dimensions. Update `LOGO_WIDTH` and
`LOGO_HEIGHT` in `src/components/brand/atlas-logo.tsx` to match.

## Light and dark

Light mode renders the mark directly on the page. Dark mode puts it on a
white plate — the wordmark is Atlas Blue, which reaches only about **2.9:1**
against the dark background. Legible, but dim, and dimming a firm's mark is
worse than plating it. Recolouring someone's brand is not ours to do.

## The source files

| File | What it is |
| --- | --- |
| `atlas-logo-source.png` | The 4000 × 4000 export as supplied. RGB, no alpha. |
| `atlas-logo-source.svg` | Supplied as an SVG, but it is a **PNG in an SVG wrapper** — zero `<path>` elements, one `<image xlink:href="data:image/png;base64,…">`. Not a vector. |
| `atlas-investments-original.svg` | An earlier auto-trace. 80 paths in 80 near-identical blues (JPEG noise, vectorised) plus an opaque white background rectangle. Reference only. |

## Colours

Sampled from the supplied artwork. Anti-aliasing only ever blends a fill
*towards* the background, never away from it, so the most saturated blue in
the file is closest to the true colour:

| Token | Value | Use |
| --- | --- | --- |
| Atlas Blue | `#1a6597` | Primary actions, links, rules |
| Atlas Blue (dark mode) | `#4a8fc2` | Same, stepped up so it stays legible |
| Atlas Gold | `#f6de6b` | Brand accent only — never a status colour |

All defined in `src/app/globals.css`. Changing the palette is a one-file edit.

## If a true vector original turns up

Worth having: real `<path>` elements, two flat fills, a transparent
background, tight bounds. Drop it in here, then in `atlas-logo.tsx` swap the
`<Image>` for the inline SVG and delete the white chip. Nothing else needs
to change.
