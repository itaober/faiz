'use client';

import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useState } from 'react';

import { loadMoreMemosAction } from '@/app/memos/_actions/load-more-memos';
import type { MemoRenderItem } from '@/lib/data/memos';

import MemoCardClient from './memo-card-client';
import MemoItemWrapper from './memo-item-wrapper';

interface MemoVirtualListProps {
  initialItems: MemoRenderItem[];
  monthsIndex: string[];
  initialLoadedMonths: number;
}

const mergeMemos = (current: MemoRenderItem[], next: MemoRenderItem[]) => {
  if (next.length === 0) return current;
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

export default function MemoVirtualList({
  initialItems,
  monthsIndex,
  initialLoadedMonths,
}: MemoVirtualListProps) {
  const [items, setItems] = useState<MemoRenderItem[]>(initialItems);
  const [loadedMonths, setLoadedMonths] = useState(initialLoadedMonths);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setItems(initialItems);
    setLoadedMonths(initialLoadedMonths);
    setLoadError(false);
    setIsLoading(false);
  }, [initialItems, initialLoadedMonths]);

  const hasMore = loadedMonths < monthsIndex.length;
  const totalCount = items.length;

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

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

  const virtualizer = useWindowVirtualizer({
    count: totalCount,
    estimateSize: () => 160,
    overscan: 6,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!hasMore || isLoading || loadError) return;
    if (virtualItems.length === 0) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem && lastItem.index >= totalCount - 3) {
      loadMore();
    }
  }, [virtualItems, totalCount, hasMore, isLoading, loadError, loadMore]);

  useEffect(() => {
    if (items.length > 0) return;
    if (!hasMore || isLoading || loadError) return;
    loadMore();
  }, [items.length, hasMore, isLoading, loadError, loadMore]);

  return (
    <div className="space-y-6">
      <article className="prose dark:prose-invert">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
        >
          {virtualItems.map(virtualRow => {
            const item = items[virtualRow.index];
            if (!item) return null;

            return (
              <div
                key={item.memo.id}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MemoItemWrapper>
                  <MemoCardClient memo={item.memo} mdxSource={item.mdxSource} />
                </MemoItemWrapper>
              </div>
            );
          })}
        </div>
      </article>

      <div />
    </div>
  );
}
