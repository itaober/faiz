'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { PreviewTrigger } from '@/components/preview';
import type { IPreviewRect } from '@/components/preview/context';
import { toPreviewRect } from '@/components/preview/geometry';
import { PREVIEW_DURATION_MS, PREVIEW_EASING } from '@/components/preview/spring';
import { cn } from '@/lib/utils';

import { type GalleryImage, getRatio, MAX_RATIO, MIN_RATIO } from './sizing.ts';

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

/** What the lightbox asks of the strip behind it. */
export interface ImageStripHandle {
  /**
   * Brings the image at `index` into view at once. Paging happens under the backdrop, so the
   * strip follows along there: the image you end on is in view, and closing lands on it where
   * it sits.
   */
  show: (index: number) => void;
  /**
   * Gives the image at `index` its whole slot back as the lightbox closes on it, and returns
   * where `source`, its picture, comes to rest. Undefined when it is already whole.
   */
  reveal: (index: number, source: HTMLElement) => IPreviewRect | undefined;
}

interface ImageStripProps {
  ref: Ref<ImageStripHandle>;
  items: GalleryImage[];
  /** Centers a strip that is narrower than its column. */
  center: boolean;
  /** Draws one image. `fill` is the part of the strip's slot it takes, for `sizes`. */
  renderImage: (
    item: GalleryImage,
    index: number,
    className: string,
    style: CSSProperties,
    fill: number,
  ) => ReactNode;
  onOpen: (index: number) => void;
}

/**
 * Two or more images in a row of one height that scrolls sideways. A strip shows mainly one
 * image, with part of the one before and the one after either side of it. An image of the shape
 * most of the strip has takes the layout's slot, and that sets one height for every image in
 * it, so nothing reflows as images load: narrower ones follow their own shape at that height,
 * wider ones crop to the same width.
 */
export default function ImageStrip({ ref, items, center, renderImage, onOpen }: ImageStripProps) {
  const scrollerRef = useRef<HTMLSpanElement | null>(null);
  // The shape most of the strip's images have (the median), which its height follows from.
  const stripRatio = items
    .map(item => Math.min(Math.max(getRatio(item) ?? 1, MIN_RATIO), MAX_RATIO))
    .sort((first, second) => first - second)[Math.floor(items.length / 2)];

  useImperativeHandle(
    ref,
    () => ({
      show: index => {
        const scroller = scrollerRef.current;
        const slot = scroller?.children[index];
        if (scroller && slot) {
          scroller.scrollLeft += getRevealDelta(scroller, slot);
        }
      },
      // An image opened while the strip cut part of it off gets its whole slot back for the
      // landing: the strip scrolls to it as the media flies home, on the same clock — the way a
      // photo grid scrolls to meet a dismissed photo. The scroll is applied at once and the slots
      // glide into place from where they were, so the strip's edge keeps cutting them, as a real
      // scroll does; the flight is aimed at where the slot comes to rest.
      reveal: (index, source) => {
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
      },
    }),
    [],
  );

  // Marks the scroller with `data-overflow-start` / `data-overflow-end` while there are more
  // images past that edge; the arrows show by them.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const sync = () => {
      const start = scroller.scrollLeft;
      scroller.toggleAttribute('data-overflow-start', start > 1);
      scroller.toggleAttribute(
        'data-overflow-end',
        scroller.scrollWidth - scroller.clientWidth - start > 1,
      );
    };
    // A child changing size (an image loading in) or joining changes the overflow without
    // resizing the scroller, so every child is watched too.
    const sizes = new ResizeObserver(sync);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(scroller);
      for (const child of scroller.children) {
        sizes.observe(child);
      }
    };
    const childList = new MutationObserver(watch);
    watch();
    childList.observe(scroller, { childList: true });
    scroller.addEventListener('scroll', sync, { passive: true });
    return () => {
      sizes.disconnect();
      childList.disconnect();
      scroller.removeEventListener('scroll', sync);
    };
  }, []);

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

  return (
    <span
      className="group/strip relative block"
      style={
        {
          '--strip-w': 'calc(100cqw + var(--gallery-bleed-start) + var(--gallery-bleed-end))',
          '--strip-slot-w': 'calc(var(--strip-w) * var(--gallery-slot))',
          '--strip-h': `min(var(--gallery-h), calc(var(--strip-slot-w) / ${stripRatio}))`,
          // Where an image comes to rest: past the end of the one before it, and the gap.
          '--strip-rest': 'calc(var(--strip-w) * var(--gallery-sliver) + 0.5rem)',
        } as CSSProperties
      }
    >
      {/* An image that comes to rest past the first leaves the end of the one before it in view,
          a sign there is more behind. The first image still starts on the text edge. It is the
          scroll container itself, bar hidden, so scrolling and snapping stay native. */}
      <span
        ref={scrollerRef}
        className="peer -ms-(--gallery-bleed-start) -me-(--gallery-bleed-end) flex snap-x snap-mandatory scroll-ps-(--strip-rest) scroll-pe-(--gallery-bleed-end) gap-2 overflow-x-auto overscroll-x-contain ps-(--gallery-bleed-start) pe-(--gallery-bleed-end) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, itemIndex) => {
          const ratio = getRatio(item);
          return (
            <span
              key={item.src}
              className={cn(
                'block max-w-(--strip-slot-w) shrink-0 snap-start',
                center && 'first:ms-auto last:me-auto',
              )}
            >
              <PreviewTrigger
                as="span"
                previewSrc={item.src}
                onOpen={() => onOpen(itemIndex)}
                ariaLabel={`Open ${item.alt}`}
                className="block rounded-md md:rounded-lg"
              >
                {/* Height is fixed; width comes from the ratio — the recorded one, else the
                    file's own once it loads (square until then). Out-of-range shapes crop. */}
                {renderImage(
                  item,
                  itemIndex,
                  'h-(--strip-h) w-auto max-w-full min-w-[calc(var(--strip-h)*9/16)] object-cover',
                  { aspectRatio: ratio === undefined ? 'auto 1 / 1' : Math.max(ratio, MIN_RATIO) },
                  Math.min(ratio ?? 1, stripRatio) / stripRatio,
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
      </span>
      {/* Mice can't scroll sideways on their own; touch and trackpads swipe, the keyboard tabs
          through the images, so these stay out of the tab order and the accessibility tree. Each
          shows on hover while the strip has more that way, so reaching an end fades one out. */}
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
            'pressable bg-surface/90 text-foreground hover:bg-surface pointer-events-none absolute top-[calc(var(--strip-h)/2)] z-20 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full opacity-0 shadow-(--fz-shadow-md) pointer-fine:flex',
            shown,
            side,
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </span>
  );
}
