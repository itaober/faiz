'use client';

import type { CSSProperties, RefObject } from 'react';
import { useEffect, useState } from 'react';

import type { PreviewPhase } from './context.ts';
import { getContainedImageRect } from './geometry.ts';

type AsidePlacement = 'right' | 'bottom';

export interface IAsideLayout {
  placement: AsidePlacement;
  style: CSSProperties;
}

export const DEFAULT_ASIDE_LAYOUT: IAsideLayout = {
  placement: 'bottom',
  style: { left: 0, top: 'calc(100% + 8px)', width: '100%' },
};

const ASIDE_WIDTH = 224;
const ASIDE_GAP = 16;
const VIEWPORT_PADDING = 16;

/**
 * Places the aside beside the media when the viewport has room for it, and
 * underneath when it doesn't.
 *
 * It measures the *contained* image rather than the frame: object-contain
 * letterboxes the media, so the frame's edge can sit far from the pixels and the
 * panel would float away from the picture it annotates.
 */
export const useAsideLayout = ({
  enabled,
  phase,
  frameRef,
}: {
  enabled: boolean;
  phase: PreviewPhase;
  frameRef: RefObject<HTMLDivElement | null>;
}) => {
  const [layout, setLayout] = useState<IAsideLayout>(DEFAULT_ASIDE_LAYOUT);

  useEffect(() => {
    if (phase !== 'open' || !enabled || !frameRef.current) {
      setLayout(DEFAULT_ASIDE_LAYOUT);
      return;
    }

    let frameId = 0;
    const updatePlacement = () => {
      const frame = frameRef.current;
      if (!frame) {
        return;
      }

      const image = frame.querySelector('img');
      const frameRect = frame.getBoundingClientRect();
      const mediaRect = image ? getContainedImageRect(image) : frameRect;
      const rightSpace = window.innerWidth - mediaRect.right;

      if (rightSpace >= ASIDE_WIDTH + ASIDE_GAP + VIEWPORT_PADDING) {
        setLayout({
          placement: 'right',
          style: {
            left: mediaRect.right - frameRect.left + ASIDE_GAP,
            top: mediaRect.top - frameRect.top,
            width: ASIDE_WIDTH,
          },
        });
      } else {
        setLayout({
          placement: 'bottom',
          style: {
            left: mediaRect.left - frameRect.left,
            top: mediaRect.bottom - frameRect.top + 8,
            width: mediaRect.width,
          },
        });
      }
    };
    const schedulePlacement = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updatePlacement);
    };

    schedulePlacement();
    const resizeObserver = new ResizeObserver(schedulePlacement);
    resizeObserver.observe(frameRef.current);
    const image = frameRef.current.querySelector('img');
    image?.addEventListener('load', schedulePlacement);
    window.addEventListener('resize', schedulePlacement);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      image?.removeEventListener('load', schedulePlacement);
      window.removeEventListener('resize', schedulePlacement);
    };
  }, [enabled, phase, frameRef]);

  return layout;
};
