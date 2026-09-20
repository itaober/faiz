/**
 * Renders the PWA icons in public/ as halftone portraits, the same treatment
 * `components/particle-image.tsx` gives the About page at runtime.
 *
 *   node scripts/generate-icons.mjs <cutout.png>
 *
 * The source is the background-removed portrait — `assets/avatar-particle.png`
 * on the content branch, the same file the About page passes to
 * `<ParticleImage>`. Keeping the background in makes a poor icon: the algorithm
 * sizes each dot by how *dark* the pixel is, so a wall behind the subject turns
 * into solid dots while the lit face stays faint, and the subject loses.
 *
 * The constants below mirror `particle-image.tsx`. They are duplicated rather
 * than imported because that file is a client component: importing it here
 * would drag in React and the DOM. If the look drifts, reconcile the two.
 *
 * Needs ImageMagick (`magick`) for pixel sampling and rasterising, and pngquant
 * to quantise — a halftone has few colours, so it quantises very well.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** particle-image.tsx: pixels at or above this luminance are background. */
const BACKGROUND_THRESHOLD = 0.88;
/**
 * Dots across the icon. The About page renders 256 CSS px at `spacing = 4`, so
 * 64 keeps the icons' dot density identical to the page they came from.
 */
const GRID = 64;
const BACKGROUND = '#f8f9f6';
const FOREGROUND = '#121210';

/**
 * Android crops a maskable icon to the device's own mask shape, guaranteeing
 * only the centre 80% circle. The portrait runs the full height of the square,
 * so it is scaled down until it clears that circle.
 */
const MASKABLE_INSET = 0.74;

const OUTPUT = [
  { file: 'icon-512x512.png', size: 512 },
  { file: 'icon-192x192.png', size: 192 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-maskable-512x512.png', size: 512, inset: MASKABLE_INSET },
  // Downsampled from 512 rather than rendered natively: at 32px the dot grid is
  // finer than the pixel grid, and resampling a larger render reads better than
  // aliasing a native one.
  { file: 'favicon-32x32.png', size: 512, resizeTo: 32 },
];

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/generate-icons.mjs <cutout.png>');
  process.exit(1);
}

/** Replicates `sampleImage()`: contain-fit into a GRID×GRID grid of RGBA. */
const sample = () =>
  execFileSync(
    'magick',
    [
      source,
      '-background',
      'none',
      '-resize',
      `${GRID}x${GRID}`,
      '-gravity',
      'center',
      '-extent',
      `${GRID}x${GRID}`,
      '-depth',
      '8',
      'RGBA:-',
    ],
    { maxBuffer: 1 << 26 },
  );

const toSvg = (pixels, size, inset) => {
  const step = (size * inset) / GRID;
  const pad = (size - size * inset) / 2;
  const dots = [];

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const i = (y * GRID + x) * 4;
      const alpha = pixels[i + 3] / 255;
      if (alpha < 0.04) {
        continue;
      }

      const luminance = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;
      if (luminance >= BACKGROUND_THRESHOLD) {
        continue;
      }

      const darkness = (BACKGROUND_THRESHOLD - luminance) / BACKGROUND_THRESHOLD;
      const radius = Math.max(0.45, step * (0.14 + darkness * 0.3));
      const opacity = alpha * (0.2 + darkness * 0.8);
      const cx = pad + (x + 0.5) * step;
      const cy = pad + (y + 0.5) * step;

      dots.push(
        `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${radius.toFixed(2)}" opacity="${opacity.toFixed(3)}"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${BACKGROUND}"/><g fill="${FOREGROUND}">${dots.join('')}</g></svg>`;
};

const pixels = sample();
const publicDir = path.join(import.meta.dirname, '..', 'public');

for (const { file, size, inset = 1, resizeTo } of OUTPUT) {
  const target = path.join(publicDir, file);
  const svg = `${target}.svg`;
  fs.writeFileSync(svg, toSvg(pixels, size, inset));

  // PNG24, never PNG32: iOS composites a home-screen icon with an alpha channel
  // over black.
  execFileSync('magick', [
    svg,
    ...(resizeTo ? ['-resize', `${resizeTo}x${resizeTo}`] : []),
    '-strip',
    `PNG24:${target}`,
  ]);
  fs.unlinkSync(svg);

  execFileSync('pngquant', [
    '--quality=70-95',
    '--speed',
    '1',
    '--strip',
    '--force',
    '--output',
    target,
    target,
  ]);

  console.log(`${file.padEnd(28)} ${String(fs.statSync(target).size).padStart(7)} B`);
}
