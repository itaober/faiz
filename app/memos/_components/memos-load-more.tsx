'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useTransition } from 'react';

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
  }, [isPending, loadMore, loadedLimit, totalAvailable]);

  if (isComplete) {
    return null;
  }

  return (
    <div className="mt-8 flex items-center justify-center">
      <div ref={sentinelRef} className="h-1 w-1" aria-hidden="true" />
    </div>
  );
}
