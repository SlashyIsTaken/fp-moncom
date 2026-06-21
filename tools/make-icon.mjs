// Generates build/icon.ico (a proper multi-size Windows icon) from build/icon.png.
//
// png-to-ico only emits 16/32/48 + the source by default, so we drive its
// internal resize + packer directly to get the full Windows size set.
// Re-run after changing build/icon.png:  node tools/make-icon.mjs
import { readPNG, resize } from 'png-to-ico/lib/png.js';
import { imagesToIco } from 'png-to-ico';
import { writeFileSync } from 'node:fs';

const SIZES = [16, 24, 32, 48, 64, 128, 256];
const SOURCE = 'build/icon.png';
const OUT = 'build/icon.ico';

const png = await readPNG(SOURCE);
if (png.width !== png.height) {
  throw new Error(`${SOURCE} must be square (got ${png.width}x${png.height}).`);
}

// Always resize from a 256px base so the small sizes downsample cleanly.
const base = png.width === 256 ? png : resize(png, 256, 256);
const images = SIZES.map((s) => (s === 256 ? base : resize(base, s, s)));

writeFileSync(OUT, imagesToIco(images));
console.log(`Wrote ${OUT} with sizes: ${SIZES.join(', ')}`);
