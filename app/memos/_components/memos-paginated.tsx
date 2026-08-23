'use client';

import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import dayjs from '@/lib/dayjs';

import MemoList from './memo-list';

interface MemoMonthGroup {
  month: string;
  /** Server-rendered memo cards for the month — MDX stays compiled at build time. */
  node: ReactNode;
}

interface MemosPaginatedProps {
  groups: MemoMonthGroup[];
}

const DEFAULT_LIMIT = 2;

const normalizeEnd = (value: string | null, monthsIndex: string[]) => {
  const fallback = monthsIndex[0] ?? '';
  if (!value) {
    return fallback;
  }
  const normalized = /^\d{4}-\d{2}$/.test(value) ? value.replace('-', '') : value;
  if (!/^\d{6}$/.test(normalized)) {
    return fallback;
  }
  const isValid = dayjs(`${normalized.slice(0, 4)}-${normalized.slice(4)}-01`).isValid();
  if (!isValid) {
    return fallback;
  }
  if (!monthsIndex.includes(normalized)) {
    return fallback;
  }
  return normalized;
};

const clampLimit = (value: number, total: number) => {
  if (total <= 0) {
    return 0;
  }
  const fallback = Math.min(DEFAULT_LIMIT, total);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const coerced = Math.floor(value);
  const minLimit = total < DEFAULT_LIMIT ? total : DEFAULT_LIMIT;
  return Math.min(Math.max(minLimit, coerced), total);
};

/**
 * Client-side month pagination over the fully baked list. All months ship in
 * the page; the static HTML shows the default window (so the content is there
 * without JS), and a `?limit=…&end=…` deep link is applied after mount —
 * reading it during render would drop the whole list from the prerendered HTML.
 */
export default function MemosPaginated({ groups }: MemosPaginatedProps) {
  const months = useMemo(() => groups.map(group => group.month), [groups]);
  const [view, setView] = useState(() => ({
    end: months[0] ?? '',
    limit: Math.min(DEFAULT_LIMIT, months.length),
  }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const end = normalizeEnd(params.get('end'), months);
    const endIndex = Math.max(0, months.indexOf(end));
    const available = months.length - endIndex;
    const limit = clampLimit(Number(params.get('limit') ?? DEFAULT_LIMIT), available);
    setView({ end, limit });
  }, [months]);

  const endIndex = Math.max(0, months.indexOf(view.end));
  const availableFromEnd = months.length - endIndex;
  const isComplete = view.limit >= availableFromEnd;
  const visibleGroups = groups.slice(endIndex, endIndex + view.limit);

  const loadMore = useCallback(() => {
    if (isComplete) {
      return;
    }
    const end = view.end || months[0] || '';
    const limit = view.limit + 1;
    const params = new URLSearchParams(window.location.search);
    params.set('limit', String(limit));
    params.set('end', end);
    window.history.replaceState(null, '', `/memos?${params.toString()}`);
    setView({ end, limit });
  }, [isComplete, months, view]);

  return (
    <>
      <MemoList>
        {visibleGroups.map(group => (
          <Fragment key={group.month}>{group.node}</Fragment>
        ))}
      </MemoList>
      {!isComplete && <MemosRevealSentinel onReveal={loadMore} />}
    </>
  );
}

/** Reveals the next month when scrolled near — same trigger as the old load-more. */
function MemosRevealSentinel({ onReveal }: { onReveal: () => void }) {
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          onReveal();
        }
      },
      { rootMargin: '800px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onReveal, sentinel]);

  return (
    <div className="mt-8 flex items-center justify-center">
      <div ref={setSentinel} className="h-1 w-1" aria-hidden="true" />
    </div>
  );
}
