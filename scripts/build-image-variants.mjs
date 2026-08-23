/**
 * Materialises content-branch images into the static build:
 *   originals  → out/api/image/assets/…        (exact URL parity with the old proxy)
 *   variants   → out/images/w{width}/assets/…  (consumed by lib/image-loader.ts)
 *
 * Resizes are content-addressed under .cache/image-variants so rebuilds only
 * pay for new or changed images. Run after `next build`:
 *   CONTENT_DIR=path/to/content node scripts/build-image-variants.mjs
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { VARIANT_WIDTHS } from '../lib/image-variants.ts';

const CONTENT_DIR = process.env.CONTENT_DIR;
if (!CONTENT_DIR) {
  throw new Error('CONTENT_DIR must point at a checkout of the content branch');
}

const OUT_DIR = 'out';
const CACHE_DIR = '.cache/image-variants';
const RASTER_EXTENSIONS = new Set(['.webp', '.jpg', '.jpeg', '.png', '.gif']);
const CONCURRENCY = 8;

const assetsRoot = path.join(CONTENT_DIR, 'assets');
const entries = await readdir(assetsRoot, { recursive: true, withFileTypes: true });
const imagePaths = entries
  .filter(
    entry => entry.isFile() && RASTER_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
  )
  .map(entry => path.relative(CONTENT_DIR, path.join(entry.parentPath, entry.name)));

let cacheHits = 0;
let resized = 0;

const buildOne = async relativePath => {
  const source = path.join(CONTENT_DIR, relativePath);
  const bytes = await readFile(source);
  const extension = path.extname(relativePath).toLowerCase();
  const contentHash = createHash('sha1').update(bytes).digest('hex');

  const original = path.join(OUT_DIR, 'api/image', relativePath);
  await mkdir(path.dirname(original), { recursive: true });
  await copyFile(source, original);

  for (const width of VARIANT_WIDTHS) {
    const target = path.join(OUT_DIR, 'images', `w${width}`, relativePath);
    await mkdir(path.dirname(target), { recursive: true });

    // Animated GIFs are copied as-is; a static resize would freeze them.
    if (extension === '.gif') {
      await copyFile(source, target);
      continue;
    }

    const cached = path.join(CACHE_DIR, `${contentHash}-w${width}${extension}`);
    try {
      await copyFile(cached, target);
      cacheHits++;
      continue;
    } catch {
      // Cache miss — resize below.
    }

    const variant = await sharp(bytes).resize({ width, withoutEnlargement: true }).toBuffer();
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cached, variant);
    await copyFile(cached, target);
    resized++;
  }
};

for (let i = 0; i < imagePaths.length; i += CONCURRENCY) {
  await Promise.all(imagePaths.slice(i, i + CONCURRENCY).map(buildOne));
}

// Loader-404 guard: every (image × width) must exist in the output.
const variantEntries = await readdir(path.join(OUT_DIR, 'images'), {
  recursive: true,
  withFileTypes: true,
});
const variantCount = variantEntries.filter(entry => entry.isFile()).length;
const expected = imagePaths.length * VARIANT_WIDTHS.length;
if (variantCount !== expected) {
  throw new Error(`Expected ${expected} image variants, found ${variantCount}`);
}

console.log(
  `Images: ${imagePaths.length} originals, ${expected} variants (${resized} resized, ${cacheHits} from cache)`,
);
