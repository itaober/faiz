export interface GalleryImage {
  /** A URL the browser can load (already resolved from a stored asset key). */
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  blurDataURL?: `data:image/${string}`;
}

type PerScreen = { mobile: number; desktop: number };

/**
 * Where a gallery sits and how large it may get. No image, alone or in a strip, grows past its
 * layout's `height`. The numbers also feed `sizes`; the classes apply them.
 *
 * On wide screens a strip ends at the text column; on phones it runs on to the screen edge (the
 * bleed).
 *
 * A strip shares its width out: `slot` to the image it rests on, the sliver to the end of the one
 * before it, and what is left shows the start of the next.
 *
 * - memo: the memo timeline, kept to the left. On phones it runs into the one-gap space by the
 *   timeline and on to the right screen edge; the column there is narrow, so the slot takes more
 *   of it and the images either side show less.
 * - post: post bodies, centered; on phones it spans the screen.
 */
export const LAYOUTS = {
  memo: {
    height: { mobile: 320, desktop: 400 },
    slot: { mobile: 0.86, desktop: 0.7 },
    column: 692,
    vars: '[--gallery-h:320px] md:[--gallery-h:400px] [--gallery-slot:0.86] md:[--gallery-slot:0.7] [--gallery-sliver:0.05] md:[--gallery-sliver:0.1] [--gallery-bleed-start:0.5rem] [--gallery-bleed-end:1.25rem] md:[--gallery-bleed-start:0px] md:[--gallery-bleed-end:0px]',
    center: false,
  },
  post: {
    height: { mobile: 600, desktop: 600 },
    slot: { mobile: 0.7, desktop: 0.7 },
    column: 720,
    vars: '[--gallery-h:var(--fz-article-image-h)] [--gallery-slot:0.7] [--gallery-sliver:0.1] [--gallery-bleed-start:1.25rem] [--gallery-bleed-end:1.25rem] md:[--gallery-bleed-start:0px] md:[--gallery-bleed-end:0px]',
    center: true,
  },
} satisfies Record<
  string,
  { height: PerScreen; slot: PerScreen; column: number; vars: string; center: boolean }
>;

export type GalleryLayout = keyof typeof LAYOUTS;

// The shapes a strip is sized for. Anything beyond crops: a long screenshot from the top instead
// of shrinking to a sliver, a panorama at the sides instead of flattening the whole strip.
export const MIN_RATIO = 9 / 16;
export const MAX_RATIO = 2;

export const getRatio = ({ width, height }: GalleryImage) =>
  width && height ? width / height : undefined;

// Roughly the width an image is drawn at: what the height allows, within its share of the column
// — all of it alone, or `fill` of a strip's slot.
export const getSizes = (
  { height, slot, column }: (typeof LAYOUTS)[GalleryLayout],
  ratio = 1,
  fill?: number,
) => {
  const share = (ofSlot: number) => (fill === undefined ? 1 : ofSlot * fill);
  return `(max-width: 767px) min(${Math.round(height.mobile * ratio)}px, ${Math.round(share(slot.mobile) * 100)}vw), ${Math.round(Math.min(height.desktop * ratio, column * share(slot.desktop)))}px`;
};
