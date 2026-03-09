'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useTransition } from 'react';

import { ANIMATION } from '@/lib/constants/animation';

interface MemosLoadMoreProps {
  loadedLimit: number;
  totalAvailable: number;
  end: string;
}

export default function MemosLoadMore({ loadedLimit, totalAvailable, end }: MemosLoadMoreProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastRequestedRef = useRef(loadedLimit);
  const isNavigatingRef = useRef(false);
  const isComplete = loadedLimit >= totalAvailable;

  useEffect(() => {
    lastRequestedRef.current = loadedLimit;
    isNavigatingRef.current = false;
  }, [loadedLimit]);

  useEffect(() => {
    if (!isPending) {
      isNavigatingRef.current = false;
    }
  }, [isPending]);

  const loadMore = useCallback(() => {
    const nextLimit = Math.min(loadedLimit + 1, totalAvailable);
    if (nextLimit <= loadedLimit) {
      return;
    }
    if (lastRequestedRef.current >= nextLimit) {
      return;
    }
    if (isNavigatingRef.current) {
      return;
    }

    lastRequestedRef.current = nextLimit;
    isNavigatingRef.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', String(nextLimit));
    params.set('end', end);
    startTransition(() => {
      router.replace(`/memos?${params.toString()}`, { scroll: false });
    });
  }, [end, loadedLimit, router, searchParams, startTransition, totalAvailable]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    if (isComplete) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        if (isPending) {
          return;
        }
        loadMore();
      },
      { rootMargin: '800px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isComplete, isPending, loadMore]);

  if (isComplete) {
    return null;
  }

  return (
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
  );
}
