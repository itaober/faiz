'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { isTransformableSrc } from '@/lib/assets';
import { cn } from '@/lib/utils';

import { usePreview } from './context.ts';

interface IPreviewImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  unoptimized?: boolean;
}

const ProgressivePreviewImage = ({
  src,
  alt,
  className,
  sizes,
  unoptimized,
}: Required<IPreviewImageProps>) => {
  const { phase, activeSourceImage, sourceImages, retargetSource } = usePreview();
  const isActiveSource = activeSourceImage?.src === src;
  const placeholderSrc = isActiveSource ? activeSourceImage.currentSrc : sourceImages.get(src);
  const [isLoaded, setIsLoaded] = useState(false);

  // Keyed by src, so this runs once per image shown; only paging while open retargets.
  useEffect(() => {
    retargetSource(src);
  }, [retargetSource, src]);
  // Opening and closing keep the source rendition, so the pixels at handover match the grid cell
  // exactly; its crop only matters when the frame's shape had to fall back to the cell's.
  const preserveSourceCrop = isActiveSource && (phase === 'opening' || phase === 'closing');
  const showPlaceholder = Boolean(placeholderSrc) && (!isLoaded || preserveSourceCrop);
  const showPreview = !placeholderSrc || (isLoaded && !preserveSourceCrop);
  const placeholderStyle = preserveSourceCrop
    ? {
        objectFit: activeSourceImage?.objectFit,
        objectPosition: activeSourceImage?.objectPosition,
      }
    : undefined;

  return (
    <>
      {showPlaceholder ? (
        <Image
          src={placeholderSrc!}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          className={cn('object-contain', className)}
          style={placeholderStyle}
          loading="eager"
          fetchPriority="high"
          unoptimized
        />
      ) : null}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={cn('object-contain', showPreview ? 'opacity-100' : 'opacity-0', className)}
        // This portal only exists because the user asked to see the image; nothing in it is
        // below the fold, so lazy loading would only delay the handover.
        loading="eager"
        fetchPriority="high"
        unoptimized={unoptimized}
        onLoad={() => setIsLoaded(true)}
      />
    </>
  );
};

export const PreviewImage = ({
  src,
  alt,
  className = '',
  sizes = '(max-width: 640px) 92vw, (max-width: 768px) 90vw, 86vw',
  unoptimized = !isTransformableSrc(src),
}: IPreviewImageProps) => (
  <ProgressivePreviewImage
    key={src}
    src={src}
    alt={alt}
    className={className}
    sizes={sizes}
    unoptimized={unoptimized}
  />
);
