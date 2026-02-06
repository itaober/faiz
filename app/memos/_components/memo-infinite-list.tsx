'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { loadMoreMemosAction } from '@/app/memos/_actions/load-more-memos';
import type { MemoRenderItem } from '@/lib/data/memos';

import MemoCardClient from './memo-card-client';
import MemoItemWrapper from './memo-item-wrapper';
import MemoList from './memo-list';

interface MemoInfiniteListProps {
  initialItems: MemoRenderItem[];
  monthsIndex: string[];
  initialLoadedMonths: number;
}

const mergeMemos = (current: MemoRenderItem[], next: MemoRenderItem[]) => {
  if (next.length === 0) {
    return current;
  }
  const seen = new Set(current.map(item => item.memo.id));
  const merged = [...current];
  for (const item of next) {
    if (!seen.has(item.memo.id)) {
      merged.push(item);
      seen.add(item.memo.id);
    }
  }
  return merged;
};

export default function MemoInfiniteList({
  initialItems,
  monthsIndex,
  initialLoadedMonths,
}: MemoInfiniteListProps) {
  const [items, setItems] = useState<MemoRenderItem[]>(initialItems);
  const [loadedMonths, setLoadedMonths] = useState(initialLoadedMonths);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setItems(initialItems);
    setLoadedMonths(initialLoadedMonths);
    setLoadError(false);
    setIsLoading(false);
  }, [initialItems, initialLoadedMonths]);

  const hasMore = loadedMonths < monthsIndex.length;

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) {
      return;
    }

    const nextMonth = monthsIndex[loadedMonths];
    if (!nextMonth) {
      setLoadedMonths(monthsIndex.length);
      return;
    }

    setIsLoading(true);
    setLoadError(false);

    const result = await loadMoreMemosAction({ month: nextMonth });
    if (result.success) {
      setItems(prev => mergeMemos(prev, result.data ?? []));
      setLoadedMonths(prev => prev + 1);
    } else {
      setLoadError(true);
    }

    setIsLoading(false);
  }, [hasMore, isLoading, loadedMonths, monthsIndex]);

  useEffect(() => {
    if (!sentinelRef.current) {
      return;
    }
    if (!hasMore || loadError) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadError, loadMore]);

  useEffect(() => {
    if (items.length > 0) {
      return;
    }
    if (!hasMore || isLoading || loadError) {
      return;
    }
    loadMore();
  }, [items.length, hasMore, isLoading, loadError, loadMore]);

  return (
    <div className="space-y-6">
      <MemoList>
        {items.map(item => (
          <MemoItemWrapper key={item.memo.id}>
            <MemoCardClient memo={item.memo} mdxSource={item.mdxSource} />
          </MemoItemWrapper>
        ))}
      </MemoList>
      <div ref={sentinelRef} />
    </div>
  );
}
