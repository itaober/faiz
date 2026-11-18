'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Image from 'next/image';
import { type CSSProperties, useRef, useState } from 'react';

import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import type { IPreviewRect } from '@/components/preview/context';
import { PREVIEW_DURATION_MS, PREVIEW_EASING, toPreviewRect } from '@/components/preview/geometry';
import ScrollArea from '@/components/scroll-area';
import { isTransformableSrc } from '@/lib/assets';
import { cn } from '@/lib/utils';

export interface MediaItem {
  /** A URL the browser can load (already resolved from a stored asset key). */
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  blurDataURL?: `data:image/${string}`;
}

type Heights = { mobile: number; desktop: number };

/**
 * A strip shows mainly one image, with part of the one before and the one after either side of
 * it. An image of the shape most of the strip has takes `SLOT` of its width, and that sets one
 * height for every image in it, so nothing reflows as images load: narrower ones follow their
 * own shape at that height, wider ones crop to the same width. No image, alone or in a strip,
 * grows past its layout's `height`. The numbers also feed `sizes`; the classes apply them.
 *
 * On wide screens a strip ends at the text column; on phones it runs on to the screen edge (the
 * bleed).
 *
 * - stream: the memo timeline, kept to the left. On phones it runs into the one-gap space by the
 *   timeline and on to the right screen edge.
 * - article: post bodies, centered; on phones it spans the screen.
 */
const LAYOUTS = {
  stream: {
    height: { mobile: 320, desktop: 400 },
    column: 692,
    vars: '[--media-h:320px] md:[--media-h:400px] [--media-bleed-start:0.5rem] [--media-bleed-end:1.25rem] md:[--media-bleed-start:0px] md:[--media-bleed-end:0px]',
    center: false,
  },
  article: {
    height: { mobile: 600, desktop: 600 },
    column: 720,
    vars: '[--media-h:var(--fz-article-image-h)] [--media-bleed-start:1.25rem] [--media-bleed-end:1.25rem] md:[--media-bleed-start:0px] md:[--media-bleed-end:0px]',
    center: true,
  },
} satisfies Record<string, { height: Heights; column: number; vars: string; center: boolean }>;

// The shapes a strip is sized for. Anything beyond crops: a long screenshot from the top instead
// of shrinking to a sliver, a panorama at the sides instead of flattening the whole strip.
const MIN_RATIO = 9 / 16;
const MAX_RATIO = 2;
// Shares of a strip's width: the image it rests on, and the end of the one before it. What is
// left shows the start of the next image.
const SLOT = 0.7;
const SLIVER = 0.1;

const getRatio = ({ width, height }: MediaItem) => (width && height ? width / height : undefined);

/** How far the strip must scroll to rest on `slot`: its start on the snap line, within range. */
const getSnapDelta = (scroller: HTMLElement, slot: Element) => {
  const padStart = Number.parseFloat(getComputedStyle(scroller).scrollPaddingLeft) || 0;
  const max = scroller.scrollWidth - scroller.clientWidth;
  const target =
    scroller.scrollLeft +
    slot.getBoundingClientRect().left -
    scroller.getBoundingClientRect().left -
    padStart;
  return Math.min(max, Math.max(0, target)) - scroller.scrollLeft;
};

/** The same, but 0 when `slot` already sits whole between the strip's snap lines. */
const getRevealDelta = (scroller: HTMLElement, slot: Element) => {
  const bounds = scroller.getBoundingClientRect();
  const rect = slot.getBoundingClientRect();
  const style = getComputedStyle(scroller);
  const padStart = Number.parseFloat(style.scrollPaddingLeft) || 0;
  const padEnd = Number.parseFloat(style.scrollPaddingRight) || 0;
  const inView = rect.left >= bounds.left + padStart - 1 && rect.right <= bounds.right - padEnd + 1;
  return inView ? 0 : getSnapDelta(scroller, slot);
};

// Roughly the width an image is drawn at: what the height allows, within its share of the column.
const getSizes = (
  { height, column }: (typeof LAYOUTS)[keyof typeof LAYOUTS],
  ratio = 1,
  share = 1,
) =>
  `(max-width: 767px) min(${Math.round(height.mobile * ratio)}px, ${Math.round(share * 100)}vw), ${Math.round(Math.min(height.desktop * ratio, column * share))}px`;

interface MediaStripProps {
  items: MediaItem[];
  layout: keyof typeof LAYOUTS;
  /** Load the first images right away, for content in the first viewport. */
  eager?: boolean;
}

/**
 * How a post's images sit in the reading flow: one image keeps its own shape under a height cap;
 * two or more form a fixed-height strip that scrolls sideways, each at its natural ratio. Every
 * image opens the shared <Preview> lightbox, which pages through the whole set.
 */
export default function MediaStrip({ items, layout, eager }: MediaStripProps) {
  const config = LAYOUTS[layout];
  const count = items.length;
  const isStrip = count > 1;
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLSpanElement | null>(null);

  if (count === 0) {
    return null;
  }

  const current = items[Math.min(index, count - 1)];
  // The shape most of the strip's images have (the median), which its height follows from.
  const stripRatio = items
    .map(item => Math.min(Math.max(getRatio(item) ?? 1, MIN_RATIO), MAX_RATIO))
    .sort((first, second) => first - second)[Math.floor(count / 2)];

  // Paging happens under the backdrop, so the strip follows along there: the image you end on is
  // in view, and closing lands on it where it sits.
  const show = (target: number) => {
    setIndex(target);
    const scroller = scrollerRef.current;
    const slot = scroller?.children[target];
    if (scroller && slot) {
      scroller.scrollLeft += getRevealDelta(scroller, slot);
    }
  };

  // An image opened while the strip cut part of it off gets its whole slot back for the landing:
  // the strip scrolls to it as the media flies home, on the same clock — the way a photo grid
  // scrolls to meet a dismissed photo. The scroll is applied at once and the slots glide into
  // place from where they were, so the strip's edge keeps cutting them, as a real scroll does;
  // the flight is aimed at where the slot comes to rest.
  const revealSource = (source: HTMLElement): IPreviewRect | undefined => {
    const scroller = scrollerRef.current;
    const slot = scroller?.children[index];
    if (!scroller || !slot) {
      return undefined;
    }
    const delta = getRevealDelta(scroller, slot);
    if (!delta) {
      return undefined;
    }
    scroller.scrollLeft += delta;
    const rect = toPreviewRect(source.getBoundingClientRect());
    for (const child of scroller.children) {
      child.animate([{ transform: `translateX(${delta}px)` }, { transform: 'none' }], {
        duration: PREVIEW_DURATION_MS,
        easing: PREVIEW_EASING,
      });
    }
    return rect;
  };

  // One image per press: on to the next image's resting place, or back to the one before.
  const scrollByImage = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const deltas = Array.from(scroller.children, slot => getSnapDelta(scroller, slot));
    const delta =
      direction > 0 ? deltas.find(left => left > 1) : deltas.reverse().find(left => left < -1);
    if (delta) {
      scroller.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  const renderImage = (
    item: MediaItem,
    itemIndex: number,
    className: string,
    style?: CSSProperties,
  ) => {
    const ratio = getRatio(item);
    return (
      <Image
        src={item.src}
        alt={item.alt}
        width={item.width ?? 0}
        height={item.height ?? 0}
        sizes={getSizes(
          config,
          ratio,
          isStrip ? (SLOT * Math.min(ratio ?? 1, stripRatio)) / stripRatio : 1,
        )}
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
          <span
            className="group/strip relative block"
            style={
              {
                '--media-strip-w':
                  'calc(100cqw + var(--media-bleed-start) + var(--media-bleed-end))',
                '--media-slot-w': `calc(var(--media-strip-w) * ${SLOT})`,
                '--media-strip-h': `min(var(--media-h), calc(var(--media-slot-w) / ${stripRatio}))`,
                // Where an image comes to rest: past the end of the one before it, and the gap.
                '--media-rest': `calc(var(--media-strip-w) * ${SLIVER} + 0.5rem)`,
              } as CSSProperties
            }
          >
            {/* An image that comes to rest past the first leaves the end of the one before it in
                view, a sign there is more behind. The first image still starts on the text
                edge. */}
            <ScrollArea
              ref={scrollerRef}
              className="peer -ms-(--media-bleed-start) -me-(--media-bleed-end) flex snap-x snap-mandatory scroll-ps-(--media-rest) scroll-pe-(--media-bleed-end) gap-2 ps-(--media-bleed-start) pe-(--media-bleed-end)"
            >
              {items.map((item, itemIndex) => {
                const ratio = getRatio(item);
                return (
                  <span
                    key={item.src}
                    className={cn(
                      'block max-w-(--media-slot-w) shrink-0 snap-start',
                      config.center && 'first:ms-auto last:me-auto',
                    )}
                  >
                    <PreviewTrigger
                      as="span"
                      previewSrc={item.src}
                      onOpen={() => setIndex(itemIndex)}
                      ariaLabel={`Open ${item.alt}`}
                      className="block rounded-md md:rounded-lg"
                    >
                      {/* Height is fixed; width comes from the ratio — the recorded one, else the
                          file's own once it loads (square until then). Out-of-range shapes crop. */}
                      {renderImage(
                        item,
                        itemIndex,
                        'h-(--media-strip-h) w-auto max-w-full min-w-[calc(var(--media-strip-h)*9/16)] object-cover',
                        {
                          aspectRatio:
                            ratio === undefined ? 'auto 1 / 1' : Math.max(ratio, MIN_RATIO),
                        },
                      )}
                    </PreviewTrigger>
                    {item.caption ? (
                      // w-0 + min-w-full: the caption fills the image's width without widening it.
                      <span className="text-muted-foreground mt-2 block w-0 min-w-full truncate text-center text-sm">
                        {item.caption}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </ScrollArea>
            {/* Mice can't scroll sideways on their own; touch and trackpads swipe, the keyboard
                tabs through the images, so these stay out of the tab order and the
                accessibility tree. Each shows on hover while the strip has more that way (the
                scroller's data-overflow-*), so reaching an end fades one out. */}
            {[
              {
                direction: -1 as const,
                shown:
                  'group-hover/strip:peer-data-overflow-start:pointer-events-auto group-hover/strip:peer-data-overflow-start:opacity-100',
                Icon: ChevronLeftIcon,
                side: 'left-2',
              },
              {
                direction: 1 as const,
                shown:
                  'group-hover/strip:peer-data-overflow-end:pointer-events-auto group-hover/strip:peer-data-overflow-end:opacity-100',
                Icon: ChevronRightIcon,
                side: 'right-2',
              },
            ].map(({ direction, shown, Icon, side }) => (
              <button
                key={direction}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => scrollByImage(direction)}
                className={cn(
                  'pressable bg-surface/90 text-foreground hover:bg-surface pointer-events-none absolute top-[calc(var(--media-strip-h)/2)] z-20 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full opacity-0 shadow-(--fz-shadow-md) pointer-fine:flex',
                  shown,
                  side,
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </span>
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
                  : { width: `min(100%, calc(var(--media-h) * ${displayRatio}))` }
              }
            >
              {displayRatio === undefined
                ? renderImage(current, 0, 'h-auto max-h-(--media-h) w-auto max-w-full')
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
        prepareReturn={isStrip ? revealSource : undefined}
      />
    </Preview>
  );
}
