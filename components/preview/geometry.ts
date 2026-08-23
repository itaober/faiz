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

export const getFlipTransform = (source: IPreviewRect, target: IPreviewRect) => {
  const scaleX = source.width / target.width;
  const scaleY = source.height / target.height;
  const translateX = source.left - target.left;
  const translateY = source.top - target.top;

  return `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
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
