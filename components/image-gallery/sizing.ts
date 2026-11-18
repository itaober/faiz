export interface GalleryImage {
  /** A URL the browser can load (already resolved from a stored asset key). */
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  blurDataURL?: `data:image/${string}`;
}

type Heights = { mobile: number; desktop: number };

/**
 * Where a gallery sits and how tall it may get. No image, alone or in a strip, grows past its
 * layout's `height`. The numbers also feed `sizes`; the classes apply them.
 *
 * On wide screens a strip ends at the text column; on phones it runs on to the screen edge (the
 * bleed).
 *
 * - memo: the memo timeline, kept to the left. On phones it runs into the one-gap space by the
 *   timeline and on to the right screen edge.
 * - post: post bodies, centered; on phones it spans the screen.
 */
export const LAYOUTS = {
  memo: {
    height: { mobile: 320, desktop: 400 },
    column: 692,
    vars: '[--gallery-h:320px] md:[--gallery-h:400px] [--gallery-bleed-start:0.5rem] [--gallery-bleed-end:1.25rem] md:[--gallery-bleed-start:0px] md:[--gallery-bleed-end:0px]',
    center: false,
  },
  post: {
    height: { mobile: 600, desktop: 600 },
    column: 720,
    vars: '[--gallery-h:var(--fz-article-image-h)] [--gallery-bleed-start:1.25rem] [--gallery-bleed-end:1.25rem] md:[--gallery-bleed-start:0px] md:[--gallery-bleed-end:0px]',
    center: true,
  },
} satisfies Record<string, { height: Heights; column: number; vars: string; center: boolean }>;

export type GalleryLayout = keyof typeof LAYOUTS;

// The shapes a strip is sized for. Anything beyond crops: a long screenshot from the top instead
// of shrinking to a sliver, a panorama at the sides instead of flattening the whole strip.
export const MIN_RATIO = 9 / 16;
export const MAX_RATIO = 2;

export const getRatio = ({ width, height }: GalleryImage) =>
  width && height ? width / height : undefined;

// Roughly the width an image is drawn at: what the height allows, within its share of the column.
export const getSizes = (
  { height, column }: (typeof LAYOUTS)[GalleryLayout],
  ratio = 1,
  share = 1,
) =>
  `(max-width: 767px) min(${Math.round(height.mobile * ratio)}px, ${Math.round(share * 100)}vw), ${Math.round(Math.min(height.desktop * ratio, column * share))}px`;
