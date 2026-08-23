'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { usePreview } from './context.ts';
import { isValidRect, toPreviewRect } from './geometry.ts';

const isImageLoaded = (image: HTMLImageElement | null | undefined) =>
  Boolean(image?.complete && image.naturalWidth && image.naturalHeight);

const getReusableImageSrc = (image: HTMLImageElement | null | undefined) => {
  // currentSrc only — it is the candidate the browser actually painted, so reusing it is a cache
  // hit. `src` is next/image's fallback, which is the *largest* srcset entry (w=3840 for a box a
  // tenth that size): reusing it would fetch and decode an image the page never displayed.
  const src = image?.currentSrc;
  if (!src) {
    return undefined;
  }

  const url = new URL(src, window.location.href);
  return url.origin === window.location.origin ? `${url.pathname}${url.search}` : url.href;
};

interface IPreviewTriggerProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  as?: 'div' | 'span';
  contained?: boolean;
  previewSrc?: string;
  onOpen?: () => void;
}

export const PreviewTrigger = ({
  children,
  className,
  ariaLabel = 'Open preview',
  as = 'div',
  contained = false,
  previewSrc,
  onOpen,
}: IPreviewTriggerProps) => {
  const {
    phaseRef,
    setPhase,
    isPreview,
    setPortalMounted,
    triggerRef,
    sourceMediaRef,
    originRectRef,
    setMediaAspectRatio,
    setSourceImage,
    setActiveSourceImage,
  } = usePreview();
  const [sourceAspectRatio, setSourceAspectRatio] = useState(1);
  const mediaRef = useRef<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const Component = as;

  const syncSourceAspectRatio = useCallback(() => {
    const image = mediaRef.current?.querySelector('img');
    if (!image?.naturalWidth || !image.naturalHeight) {
      return undefined;
    }

    const aspectRatio = image.naturalWidth / image.naturalHeight;
    setSourceAspectRatio(aspectRatio);
    return aspectRatio;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: children is the trigger — a new rendered image needs its load listener re-attached
  useEffect(() => {
    const image = mediaRef.current?.querySelector('img');
    const syncSourceImage = () => {
      const aspectRatio = syncSourceAspectRatio();
      const currentSrc = getReusableImageSrc(image);
      if (aspectRatio && previewSrc && currentSrc) {
        setSourceImage(previewSrc, currentSrc);
      }
    };

    if (isImageLoaded(image)) {
      syncSourceImage();
    }
    image?.addEventListener('load', syncSourceImage);
    return () => image?.removeEventListener('load', syncSourceImage);
  }, [children, previewSrc, setSourceImage, syncSourceAspectRatio]);

  const mediaStyle = contained
    ? sourceAspectRatio >= 1
      ? { width: '100%', height: 'auto', aspectRatio: sourceAspectRatio }
      : { width: 'auto', height: '100%', aspectRatio: sourceAspectRatio }
    : undefined;
  const mediaClassName = contained ? 'absolute inset-0 m-auto block' : 'relative block w-full';
  const media = (
    <Component
      ref={element => {
        mediaRef.current = element;
      }}
      className={mediaClassName}
      style={mediaStyle}
    >
      {children}
    </Component>
  );

  return (
    <Component data-preview={isPreview} className={cn('relative', className)}>
      {media}
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isPreview}
        onClick={() => {
          if (phaseRef.current !== 'closed' || !mediaRef.current) {
            return;
          }

          const sourceRect = toPreviewRect(mediaRef.current.getBoundingClientRect());
          if (!isValidRect(sourceRect)) {
            return;
          }

          triggerRef.current = buttonRef.current;
          sourceMediaRef.current = mediaRef.current;
          originRectRef.current = sourceRect;

          const aspectRatio = syncSourceAspectRatio() ?? sourceRect.width / sourceRect.height;
          setMediaAspectRatio(aspectRatio);

          const image = mediaRef.current.querySelector('img');
          const currentSrc = getReusableImageSrc(image);
          if (previewSrc && currentSrc) {
            const imageStyle = image ? getComputedStyle(image) : undefined;
            setActiveSourceImage({
              src: previewSrc,
              currentSrc,
              objectFit: imageStyle?.objectFit as CSSProperties['objectFit'],
              objectPosition: imageStyle?.objectPosition,
            });
            if (isImageLoaded(image)) {
              setSourceImage(previewSrc, currentSrc);
            }
          } else {
            setActiveSourceImage(null);
          }

          onOpen?.();
          setPortalMounted(true);
          setPhase('opening');
        }}
        className="focus-ring absolute inset-0 z-10 cursor-pointer rounded-[inherit]"
      />
    </Component>
  );
};
