'use client';

import Image from 'next/image';
import { useState } from 'react';

import { isTransformableSrc } from '@/lib/assets';
import { cn } from '@/lib/utils';

import { usePreview } from './context.ts';

interface IPreviewImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  unoptimized?: boolean;
  /**
   * Whether to fetch the full image yet. Off, only the rendition the page already loaded shows:
   * a row holds its far pictures back until they are next in line.
   */
  load?: boolean;
}

const ProgressivePreviewImage = ({
  src,
  alt,
  className,
  sizes,
  unoptimized,
  load,
}: Required<IPreviewImageProps>) => {
  const { phase, activeSourceImage, sourceImages } = usePreview();
  const isActiveSource = activeSourceImage?.src === src;
  const placeholderSrc = isActiveSource ? activeSourceImage.currentSrc : sourceImages.get(src);
  const [isLoaded, setIsLoaded] = useState(false);
  // Once fetched it stays, so paging back shows it at once.
  const [wanted, setWanted] = useState(load);
  if (load && !wanted) {
    setWanted(true);
  }

  // Opening and closing keep the source rendition, so the pixels at handover match the grid cell
  // exactly; its crop only matters when the frame's shape had to fall back to the cell's.
  const preserveSourceCrop = isActiveSource && (phase === 'opening' || phase === 'closing');
  const showPreview = !placeholderSrc || (isLoaded && !preserveSourceCrop);
  const placeholderStyle = preserveSourceCrop
    ? {
        objectFit: activeSourceImage?.objectFit,
        objectPosition: activeSourceImage?.objectPosition,
      }
    : undefined;

  return (
    <>
      {/* Stays underneath for as long as the preview is up: the full image fades in over it, and
          closing only has to uncover it. Swapping one for the other leaves a frame with neither
          while the incoming one decodes. */}
      {placeholderSrc ? (
        <Image
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          className={cn('object-contain', className)}
          style={placeholderStyle}
          loading="eager"
          decoding="sync"
          fetchPriority="high"
          unoptimized
        />
      ) : null}
      {wanted || !placeholderSrc ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className={cn(
            'object-contain',
            // Sharpens in rather than popping; hiding it for the flight home is immediate.
            showPreview ? 'opacity-100 transition-opacity duration-(--fz-dur-slow)' : 'opacity-0',
            className,
          )}
          // This portal only exists because the user asked to see the image; nothing in it is
          // below the fold, so lazy loading would only delay the handover.
          loading="eager"
          fetchPriority={isActiveSource ? 'high' : undefined}
          unoptimized={unoptimized}
          onLoad={() => setIsLoaded(true)}
        />
      ) : null}
    </>
  );
};

export const PreviewImage = ({
  src,
  alt,
  className = '',
  sizes = '(max-width: 640px) 92vw, (max-width: 768px) 90vw, 86vw',
  unoptimized = !isTransformableSrc(src),
  load = true,
}: IPreviewImageProps) => (
  <ProgressivePreviewImage
    key={src}
    src={src}
    alt={alt}
    className={className}
    sizes={sizes}
    unoptimized={unoptimized}
    load={load}
  />
);
