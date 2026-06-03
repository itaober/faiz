'use client';

import { ArrowUpIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useWindowScroll } from '@/hooks/use-window-event';
import { cn } from '@/lib/utils';

const SHOW_OFFSET = 240;

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  const handleScroll = useCallback(() => setVisible(window.scrollY > SHOW_OFFSET), []);
  useWindowScroll(handleScroll);
  // Reflect the initial scroll position on mount.
  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      className={cn(
        'focus-ring pressable bg-background/45 text-muted-foreground/60 fixed right-5 bottom-5 z-20 inline-flex size-8 items-center justify-center rounded-full border border-transparent opacity-0 transition-[transform,opacity,color,background-color,border-color] duration-200 ease-(--ease-out)',
        'hover:border-border/70 hover:bg-background/80 hover:text-foreground hover:opacity-100',
        visible && 'pointer-events-auto opacity-60',
        !visible && 'pointer-events-none',
      )}
      onClick={scrollToTop}
    >
      <ArrowUpIcon className="size-4" />
    </button>
  );
}
