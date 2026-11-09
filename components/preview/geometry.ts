import { ANIMATION } from '@/lib/constants/animation';

import type { IPreviewRect } from './context.ts';

export const PREVIEW_DURATION_MS = 280;
export const PREVIEW_CLOSE_TIMEOUT_MS = 1000;
export const PREVIEW_PAINT_WAIT_MS = 300;
export const PREVIEW_EASING = `cubic-bezier(${ANIMATION.ease.out.join(',')})`;

export const toPreviewRect = (rect: DOMRect): IPreviewRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

export const isValidRect = (rect: IPreviewRect | null | undefined): rect is IPreviewRect =>
  Boolean(rect?.width && rect.height);

export type IPreviewFlipFrame = {
  transform: string;
  clipPath: string;
};

export const PREVIEW_FULL_FRAME: IPreviewFlipFrame = {
  transform: 'none',
  clipPath: 'inset(0px 0px 0px 0px round 0px)',
};

/**
 * Places the frame (laid out at `target`, the media's own aspect ratio) so that what shows is
 * exactly `source`, the way `object-fit: cover` crops it there: a uniform scale that covers the
 * source box, plus a centered clip. Interpolating to {@link PREVIEW_FULL_FRAME} un-crops the media
 * continuously, so a square grid cell grows into a portrait or landscape preview without ever
 * squashing or snapping its shape at the end.
 */
export const getCoverFlip = (
  source: IPreviewRect,
  target: IPreviewRect,
  sourceRadius = 0,
): IPreviewFlipFrame => {
  const scale = Math.max(source.width / target.width, source.height / target.height);
  const insetX = (target.width - source.width / scale) / 2;
  const insetY = (target.height - source.height / scale) / 2;
  const translateX = source.left - target.left - insetX * scale;
  const translateY = source.top - target.top - insetY * scale;

  return {
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
    clipPath: `inset(${insetY}px ${insetX}px ${insetY}px ${insetX}px round ${sourceRadius / scale}px)`,
  };
};

/** Corner radius the source media is drawn with, so the flight starts and lands on its shape. */
export const getSourceRadius = (source: HTMLElement | null) => {
  let element = source?.querySelector('img') ?? source;
  while (element) {
    const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
    if (radius > 0 || element === source) {
      return radius || 0;
    }
    element = element.parentElement;
  }
  return 0;
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
