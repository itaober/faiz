'use client';

import Image from 'next/image';
import { type CSSProperties, useRef, useState } from 'react';

import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import { isTransformableSrc } from '@/lib/assets';
import { cn } from '@/lib/utils';

import ImageStrip, { type ImageStripHandle } from './image-strip.tsx';
import {
  type GalleryImage,
  type GalleryLayout,
  getRatio,
  getSizes,
  LAYOUTS,
  MIN_RATIO,
} from './sizing.ts';

interface ImageGalleryProps {
  items: GalleryImage[];
  layout: GalleryLayout;
  /** Load the first images right away, for content in the first viewport. */
  eager?: boolean;
}

/**
 * How a memo's or post's images sit in the reading flow: one image keeps its own shape under a
 * height cap; two or more form a fixed-height strip that scrolls sideways, each at its natural
 * ratio. Every image opens the shared <Preview> lightbox, which pages through the whole set.
 */
export default function ImageGallery({ items, layout, eager }: ImageGalleryProps) {
  const config = LAYOUTS[layout];
  const count = items.length;
  const isStrip = count > 1;
  const [index, setIndex] = useState(0);
  const stripRef = useRef<ImageStripHandle>(null);

  if (count === 0) {
    return null;
  }

  const current = items[Math.min(index, count - 1)];

  const show = (target: number) => {
    setIndex(target);
    stripRef.current?.show(target);
  };

  const renderImage = (
    item: GalleryImage,
    itemIndex: number,
    className: string,
    style?: CSSProperties,
    fill?: number,
  ) => {
    const ratio = getRatio(item);
    return (
      <Image
        src={item.src}
        alt={item.alt}
        width={item.width ?? 0}
        height={item.height ?? 0}
        sizes={getSizes(config, ratio, fill)}
        loading={eager && itemIndex < 2 ? 'eager' : undefined}
        placeholder={item.blurDataURL ?? 'empty'}
        unoptimized={!isTransformableSrc(item.src)}
        className={cn(
          'fz-img-outline block rounded-md bg-[var(--fz-image-frame)] md:rounded-lg',
          // A tall crop keeps the top, where a screenshot's content starts.
          ratio !== undefined && ratio < MIN_RATIO && 'object-top',
          className,
        )}
        style={style}
      />
    );
  };

  const currentRatio = getRatio(current);
  const displayRatio = currentRatio === undefined ? undefined : Math.max(currentRatio, MIN_RATIO);

  return (
    <Preview>
      {/* Spans throughout: an MDX image can land inside a paragraph. */}
      <span className={cn('not-prose @container block', config.vars)}>
        {isStrip ? (
          <ImageStrip
            ref={stripRef}
            items={items}
            center={config.center}
            renderImage={renderImage}
            onOpen={setIndex}
          />
        ) : (
          <>
            <PreviewTrigger
              as="span"
              previewSrc={current.src}
              ariaLabel={`Open ${current.alt}`}
              className={cn(
                'block rounded-md md:rounded-lg',
                config.center && 'mx-auto',
                displayRatio === undefined && 'w-fit max-w-full',
              )}
              // The slot takes the image's width, so the click target and the lightbox's origin
              // match the picture rather than the whole column.
              style={
                displayRatio === undefined
                  ? undefined
                  : { width: `min(100%, calc(var(--gallery-h) * ${displayRatio}))` }
              }
            >
              {displayRatio === undefined
                ? renderImage(current, 0, 'h-auto max-h-(--gallery-h) w-auto max-w-full')
                : renderImage(current, 0, 'h-auto w-full object-cover', {
                    aspectRatio: displayRatio,
                  })}
            </PreviewTrigger>
            {current.caption ? (
              <span className="text-muted-foreground mt-2 block text-center text-sm">
                {current.caption}
              </span>
            ) : null}
          </>
        )}
      </span>
      <PreviewPortal
        ariaLabel={`Image preview: ${current.alt}`}
        slides={items.map((item, itemIndex) => {
          const ratio = getRatio(item);
          return {
            src: item.src,
            aspectRatio: ratio,
            media: (
              <PreviewImage
                src={item.src}
                alt={item.alt}
                // The frame's own limits: 90% of the screen across, 80% down, 64rem.
                sizes={ratio ? `min(90vw, ${Math.round(80 * ratio)}vh, 64rem)` : undefined}
                // The neighbours' full images are ready before they are paged to.
                load={Math.abs(itemIndex - index) <= 1}
              />
            ),
            footer:
              isStrip || item.caption ? (
                <p className="text-overlay-control-foreground text-center text-sm">
                  {item.caption}
                  {isStrip ? (
                    <span className={cn('font-mono text-xs', item.caption && 'ms-2 opacity-70')}>
                      {itemIndex + 1} / {count}
                    </span>
                  ) : null}
                </p>
              ) : undefined,
          };
        })}
        index={index}
        onIndexChange={show}
        prepareReturn={isStrip ? source => stripRef.current?.reveal(index, source) : undefined}
      />
    </Preview>
  );
}
