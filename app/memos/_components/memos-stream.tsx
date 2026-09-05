'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { ANIMATION } from '@/lib/constants/animation';

import { loadMemosPageAction } from '../_actions/load-memos-page';
import MemoList from './memo-list';

interface MemosStreamProps {
  children: React.ReactNode;
  /** Month offset the next load should fetch; null when everything is loaded. */
  initialNextOffset: number | null;
}

/**
 * Owns infinite scroll for the static memos page: the first months arrive as
 * server-rendered children, later months are appended from the load-more
 * server action (also server-rendered) without re-rendering the route.
 */
export default function MemosStream({ children, initialNextOffset }: MemosStreamProps) {
  const [pages, setPages] = useState<React.ReactNode[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedOffsetRef = useRef<number | null>(null);

  const loadMore = useCallback(() => {
    if (nextOffset === null || requestedOffsetRef.current === nextOffset) {
      return;
    }
    requestedOffsetRef.current = nextOffset;
    startTransition(async () => {
      const page = await loadMemosPageAction(nextOffset);
      setPages(prev => [...prev, page.items]);
      setNextOffset(page.nextOffset);
    });
  }, [nextOffset]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || nextOffset === null) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isPending) {
          loadMore();
        }
      },
      { rootMargin: '800px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextOffset, isPending, loadMore]);

  return (
    <>
      <MemoList>
        {children}
        {pages}
      </MemoList>
      {nextOffset !== null && (
        <div className="mt-8 flex items-center justify-center">
          <div ref={sentinelRef} className="h-1 w-1" aria-hidden="true" />
          <AnimatePresence initial={false}>
            {isPending ? (
              <motion.div
                className="bg-border relative h-px w-16 overflow-hidden rounded-full"
                initial={{ opacity: 0, scaleX: 0.92 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0, scaleX: 0.96 }}
                transition={{ duration: 0.2, ease: ANIMATION.ease.out }}
                aria-hidden="true"
              >
                <motion.div
                  className="bg-foreground/40 absolute inset-y-0 left-0 w-1/2 rounded-full"
                  initial={{ x: '-120%' }}
                  animate={{ x: '220%' }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 0.9,
                    ease: ANIMATION.ease.out,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatDelay: 0.05,
                  }}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
