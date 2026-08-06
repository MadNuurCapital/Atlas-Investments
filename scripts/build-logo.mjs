import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Rebuild public/brand/atlas-logo.png from the supplied export.
 *
 * Run this only when the firm sends a new file. The output is committed, so
 * a normal build never touches it.
 *
 * Remove the opaque white background: a global "make white transparent" would
 * punch a hole through the white square INSIDE the mark, so this floods
 * inwards from the image border and clears only the pixels the flood can
 * reach. The mark's interior white is enclosed by blue, so the flood never
 * gets there and it stays opaque.
 *
 * The gold accent square is safe for a different reason: the test is
 * distance-to-white in RGB, not luminance. Gold is a light colour (luminance
 * ~216) and a luminance test would have eaten it, but its blue channel is 107,
 * putting it 148 away from white — far outside the 48 threshold.
 *
 *   node scripts/build-logo.mjs
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(root, "public/brand/atlas-logo-source.png");
const OUT = resolve(root, "public/brand/atlas-logo.png");

/* Chromium is used purely as an image decoder and canvas — it keeps this
   script dependency-free beyond what the repo already installs. */
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();

const dataUri = `data:image/png;base64,${readFileSync(SRC).toString("base64")}`;

const result = await page.evaluate(async (uri) => {
  const img = new Image();
  img.src = uri;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  const W = canvas.width;
  const H = canvas.height;
  const image = ctx.getImageData(0, 0, W, H);
  const d = image.data;

  const THRESHOLD = 48;
  const nearWhite = (i) =>
    Math.max(255 - d[i], 255 - d[i + 1], 255 - d[i + 2]) < THRESHOLD;

  // --- Flood fill inwards from every border pixel ---------------------
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) {
    stack.push(x, x + (H - 1) * W);
  }
  for (let y = 0; y < H; y++) {
    stack.push(y * W, W - 1 + y * W);
  }

  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!nearWhite(i)) continue;
    d[i + 3] = 0;

    const x = p % W;
    const y = (p / W) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }

  ctx.putImageData(image, 0, 0);

  // --- Crop to what is actually left ----------------------------------
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d").drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);

  return {
    source: `${W}x${H}`,
    cropped: `${cw}x${ch}`,
    dataUrl: out.toDataURL("image/png"),
  };
}, dataUri);

writeFileSync(OUT, Buffer.from(result.dataUrl.split(",")[1], "base64"));
console.log(`${result.source} -> ${result.cropped}, transparent background`);

await browser.close();
