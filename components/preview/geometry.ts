import { ANIMATION } from '@/lib/constants/animation';

import type { IPreviewRect } from './context.ts';

/**
 * Everything in the preview moves on one spring curve: the site's stiffness, damped so it never
 * overshoots. It leaves gently and lands softly, so the eye can follow a picture across the
 * screen; an ease-out covers most of that distance within two frames, which reads as a jump.
 */
const SPRING_RATE = Math.sqrt(ANIMATION.spring.stiffness);
// How long the spring is run for, in units of its own rate: 99.5% of the way there.
const SPRING_SETTLE = 7.5;
/** A page turn takes the spring's own time: the row has a whole picture's width to cover. */
export const PREVIEW_TURN_MS = (SPRING_SETTLE / SPRING_RATE) * 1000;
/** Opening and closing answer a tap, so they play the same curve at the site's `slow` pace. */
export const PREVIEW_DURATION_MS = ANIMATION.duration.slow * 1000;

/**
 * The spring's way back to rest for something `from` px off and moving at `velocity` px/s: where
 * it is, and how fast, `seconds` later. One formula covers a page turn, a flick let go mid-drag
 * and a nudge off either end, and lets a new turn pick up exactly where the last one is.
 */
export const getSpringPath = (from: number, velocity: number) => {
  const pull = velocity + SPRING_RATE * from;
  const offsetAt = (seconds: number) => (from + pull * seconds) * Math.exp(-SPRING_RATE * seconds);
  const duration = PREVIEW_TURN_MS / 1000;
  const left = offsetAt(duration);
  return {
    // The little the spring still has left at the end is taken off along the way, so the path
    // lands exactly.
    offsetAt: (seconds: number) =>
      seconds < duration ? offsetAt(seconds) - left * (seconds / duration) : 0,
    velocityAt: (seconds: number) =>
      (velocity - SPRING_RATE * pull * seconds) * Math.exp(-SPRING_RATE * seconds),
  };
};

// The same spring from a standstill, as an easing for a flight between two poses.
const SPRING_SAMPLES = Array.from({ length: 31 }, (_, index) =>
  (1 - getSpringPath(1, 0).offsetAt((index / 30) * (PREVIEW_TURN_MS / 1000))).toFixed(4),
);
export const PREVIEW_EASING =
  typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)')
    ? `linear(${SPRING_SAMPLES.join(',')})`
    : // The closest cubic curve, for browsers without linear().
      'cubic-bezier(0.25, 0.25, 0.1, 1)';
export const PREVIEW_CLOSE_TIMEOUT_MS = 1000;
export const PREVIEW_PAINT_WAIT_MS = 300;

export const toPreviewRect = (rect: DOMRect): IPreviewRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

export const isValidRect = (rect: IPreviewRect | null | undefined): rect is IPreviewRect =>
  Boolean(rect?.width && rect.height);

/** A pose of the flying frame: where it sits and how much of it the cover crop shows. */
export type PreviewFlipFrame = {
  transform: string;
  clipPath: string;
};

export const PREVIEW_FULL_FRAME: PreviewFlipFrame = {
  transform: 'none',
  clipPath: 'inset(0px 0px 0px 0px round 0px)',
};

export const applyFlipFrame = (frame: HTMLElement, pose: PreviewFlipFrame) => {
  frame.style.transform = pose.transform;
  frame.style.clipPath = pose.clipPath;
};

/**
 * The pose a frame is in, from its inline style (as last applied) or its computed style (frozen
 * mid-animation). An unset part, or a clip of `none` that can't interpolate, reads as the full frame.
 */
export const readFlipFrame = (style: CSSStyleDeclaration): PreviewFlipFrame => ({
  transform: style.transform && style.transform !== 'none' ? style.transform : 'none',
  clipPath:
    style.clipPath && style.clipPath !== 'none' ? style.clipPath : PREVIEW_FULL_FRAME.clipPath,
});

/** How the source media is drawn on the page, beyond its box. */
export interface SourceLook {
  radius: number;
  /** `object-position` as fractions: where a cover crop takes its slice from. */
  position: [number, number];
}

const NO_LOOK: SourceLook = { radius: 0, position: [0.5, 0.5] };

/** The scale and offset that lay `target` (the media's own shape) over the `source` box, covering it. */
const getCover = (source: IPreviewRect, target: IPreviewRect, look: SourceLook) => {
  const scale = Math.max(source.width / target.width, source.height / target.height);
  const spareX = target.width - source.width / scale;
  const spareY = target.height - source.height / scale;
  return { scale, spareX, spareY, left: spareX * look.position[0], top: spareY * look.position[1] };
};

/**
 * Places the frame (laid out at `target`, the media's own aspect ratio) so that what shows is
 * exactly what the source box shows: a uniform scale that covers the box, plus a clip that crops
 * the way its `object-position` does. Interpolating to {@link PREVIEW_FULL_FRAME} un-crops the
 * media continuously, so the flight leaves and lands on the very pixels the page shows.
 */
export const getCoverFlip = (
  source: IPreviewRect,
  target: IPreviewRect,
  look: SourceLook = NO_LOOK,
): PreviewFlipFrame => {
  const { scale, spareX, spareY, left, top } = getCover(source, target, look);
  const translateX = source.left - target.left - left * scale;
  const translateY = source.top - target.top - top * scale;

  return {
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
    clipPath: `inset(${top}px ${spareX - left}px ${spareY - top}px ${left}px round ${look.radius / scale}px)`,
  };
};

/** Drives {@link getRevealMask}: 0 keeps what the page hid out of sight, 1 shows the media whole. */
export const PREVIEW_REVEAL = '--fz-reveal';

/**
 * A mask for a frame whose source a sideways scroller partly hides: opaque over what the page
 * shows and {@link PREVIEW_REVEAL} over the rest. The picture lifts off the page whole, at its
 * own shape, and the part that was out of sight dissolves in instead of appearing at once.
 * Undefined when nothing is hidden.
 */
export const getRevealMask = (
  source: HTMLElement,
  rect: IPreviewRect,
  target: IPreviewRect,
  look: SourceLook,
) => {
  const cut = { left: 0, right: 0 };
  for (let element = source.parentElement; element; element = element.parentElement) {
    if (getComputedStyle(element).overflowX === 'visible') {
      continue;
    }
    const box = element.getBoundingClientRect();
    cut.left = Math.max(cut.left, box.left - rect.left);
    cut.right = Math.max(cut.right, rect.left + rect.width - box.right);
  }
  if (cut.left < 0.5 && cut.right < 0.5) {
    return undefined;
  }

  // In the frame's own pixels, which the flight then scales.
  const { scale, left } = getCover(rect, target, look);
  const start = left + cut.left / scale;
  const end = left + (rect.width - cut.right) / scale;
  const hidden = `rgb(0 0 0 / var(${PREVIEW_REVEAL}))`;
  const stops = [
    ...(cut.left < 0.5 ? [] : [`${hidden} ${start}px`, `#000 ${start}px`]),
    ...(cut.right < 0.5 ? ['#000'] : [`#000 ${end}px`, `${hidden} ${end}px`]),
  ];
  return `linear-gradient(to right, ${stops.join(', ')})`;
};

const parsePosition = (value: string): [number, number] => {
  const [x = '50%', y = '50%'] = value.split(' ');
  const fraction = (part: string) => (part.endsWith('%') ? Number.parseFloat(part) / 100 : 0.5);
  return [fraction(x), fraction(y)];
};

export const getSourceLook = (source: HTMLElement | null): SourceLook => {
  if (!source) {
    return NO_LOOK;
  }
  const image = source.querySelector('img');
  return {
    radius: getSourceRadius(source),
    position: parsePosition(image ? getComputedStyle(image).objectPosition : ''),
  };
};

/**
 * Corner radius the source media is drawn with, so the flight starts and lands on its shape. The
 * rounding sits on the image, a clipping wrapper, or the trigger just outside `source`.
 */
const getSourceRadius = (source: HTMLElement) => {
  const boundary = source.parentElement ?? source;
  let element: HTMLElement | null = source.querySelector('img') ?? source;
  while (element) {
    const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
    if (radius > 0) {
      return radius;
    }
    if (element === boundary) {
      return 0;
    }
    element = element.parentElement;
  }
  return 0;
};

export const getSlideCenter = (slide: HTMLElement) => slide.offsetLeft + slide.offsetWidth / 2;

/**
 * What a row of slides shows once it has slid `offset` px off the slide at `index`: the two
 * slides either side of the middle, how far along from `near` to `far` the middle is (`blend`),
 * and the `span` both fit in whole. Past either end the last slide is simply carried along,
 * `drift` px off centre.
 */
export const getRowView = (slides: HTMLCollection, index: number, offset: number) => {
  const step = offset > 0 ? -1 : 1;
  const view = getSlideCenter(slides[index] as HTMLElement) - offset;
  let at = index;
  // Walks on while the next slide's middle has already gone by.
  while (
    slides[at + step] &&
    (getSlideCenter(slides[at + step] as HTMLElement) - view) * step < 0
  ) {
    at += step;
  }
  const near = slides[at] as HTMLElement;
  const far = (slides[at + step] ?? near) as HTMLElement;
  const reach = getSlideCenter(far) - getSlideCenter(near);
  return {
    near,
    far,
    blend: reach ? (view - getSlideCenter(near)) / reach : 0,
    span: Math.max(near.offsetWidth, far.offsetWidth),
    drift: reach ? 0 : getSlideCenter(near) - view,
  };
};

export const areRectsEqual = (first: IPreviewRect, second: IPreviewRect) =>
  Math.abs(first.left - second.left) < 0.5 &&
  Math.abs(first.top - second.top) < 0.5 &&
  Math.abs(first.width - second.width) < 0.5 &&
  Math.abs(first.height - second.height) < 0.5;

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Resolves once the frame's image can be painted. The portal's `<img>` is created on the same tick
 * the preview opens, so on anything slower than localhost it needs a fetch and a decode first —
 * without this wait the FLIP runs against an empty box and the media only appears once it is over.
 * Capped so a stalled image can never trap the user in a dimmed overlay whose controls are hidden.
 */
export const whenPaintable = (frame: HTMLElement) => {
  const image = frame.querySelector('img');
  if (!image || typeof image.decode !== 'function') {
    return Promise.resolve();
  }

  return Promise.race([
    // decode() waits for the load too, so it covers an image that hasn't arrived yet.
    image.decode().catch(() => undefined),
    new Promise(resolve => window.setTimeout(resolve, PREVIEW_PAINT_WAIT_MS)),
  ]);
};

export const getContainedImageRect = (image: HTMLImageElement) => {
  const rect = image.getBoundingClientRect();
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) {
    return rect;
  }

  const imageRatio = naturalWidth / naturalHeight;
  const frameRatio = rect.width / rect.height;

  if (imageRatio > frameRatio) {
    const height = rect.width / imageRatio;
    return new DOMRect(rect.left, rect.top + (rect.height - height) / 2, rect.width, height);
  }

  const width = rect.height * imageRatio;
  return new DOMRect(rect.left + (rect.width - width) / 2, rect.top, width, rect.height);
};

export const getFocusableElements = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
