'use client';

import { type ComponentProps, useEffect, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * A sideways scroller with the bar hidden. It carries `data-overflow-start` / `data-overflow-end`
 * while there is more content past that edge, for anything styled around it.
 *
 * It is the scroll container itself, so scrolling, snapping and `scrollLeft` stay native. A span,
 * so it can sit inside a paragraph (an MDX image); give it `flex` or `block` as the layout needs.
 */
export default function ScrollArea({ ref, className, ...rest }: ComponentProps<'span'>) {
  const areaRef = useRef<HTMLSpanElement | null>(null);
  useImperativeHandle(ref, () => areaRef.current as HTMLSpanElement, []);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) {
      return;
    }
    const sync = () => {
      const start = area.scrollLeft;
      area.toggleAttribute('data-overflow-start', start > 1);
      area.toggleAttribute('data-overflow-end', area.scrollWidth - area.clientWidth - start > 1);
    };
    // A child changing size (an image loading in) or joining changes the overflow without
    // resizing the area, so every child is watched too.
    const sizes = new ResizeObserver(sync);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(area);
      for (const child of area.children) {
        sizes.observe(child);
      }
    };
    const childList = new MutationObserver(watch);
    watch();
    childList.observe(area, { childList: true });
    area.addEventListener('scroll', sync, { passive: true });
    return () => {
      sizes.disconnect();
      childList.disconnect();
      area.removeEventListener('scroll', sync);
    };
  }, []);

  return (
    <span
      ref={areaRef}
      className={cn(
        'overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...rest}
    />
  );
}
