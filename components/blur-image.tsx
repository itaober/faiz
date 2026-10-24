'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface IBlurImageProps extends Omit<ImageProps, 'placeholder' | 'blurDataURL'> {
  blurDataURL?: string;
}

/**
 * next/image with its tiny `blurDataURL` painted behind it through a CSS blur
 * until the file loads. Next's own `placeholder="blur"` scales its SVG blur to
 * the intrinsic width, which on a 1920px source leaves an 8px preview as a grid
 * of colour blocks. The layer is a span, not an img: the preview lightbox picks
 * the trigger's first `img`. Its parent must be positioned and clip overflow.
 *
 * The image is positioned too, so it stacks above the layer and shows the
 * moment it loads, before hydration. Removing the layer on load only matters for
 * images with transparency.
 */
export default function BlurImage({ blurDataURL, className, onLoad, ...props }: IBlurImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {blurDataURL && !loaded ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center blur-xl"
          style={{ backgroundImage: `url("${blurDataURL}")` }}
        />
      ) : null}
      <Image
        {...props}
        className={cn('relative', className)}
        onLoad={event => {
          setLoaded(true);
          onLoad?.(event);
        }}
      />
    </>
  );
}
