'use client';

import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import MemoList from './memo-list';

interface MemoMonthGroup {
  month: string;
  /** Server-rendered cards for the month — MDX stays compiled at build time. */
  node: ReactNode;
}

const DEFAULT_LIMIT = 2;

/** `months` is derived from real filenames, so membership is the only check needed. */
const resolveStartIndex = (end: string | null, months: string[]) => {
  const index = months.indexOf(end?.replace('-', '') ?? '');
  return index === -1 ? 0 : index;
};

const clampLimit = (value: string | null, available: number) =>
  Math.min(Math.max(Math.floor(Number(value)) || DEFAULT_LIMIT, DEFAULT_LIMIT), available);

/**
 * Client-side month pagination over the fully baked list. Every month ships in
 * the page; the static HTML shows the default window so the content is there
 * without JS, and a `?limit=…&end=…` deep link is applied after mount —
 * reading it during render would drop the list from the prerendered HTML.
 */
export default function MemosPaginated({ groups }: { groups: MemoMonthGroup[] }) {
  const months = useMemo(() => groups.map(group => group.month), [groups]);
  const [view, setView] = useState({ startIndex: 0, limit: DEFAULT_LIMIT });
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const startIndex = resolveStartIndex(params.get('end'), months);
    setView({ startIndex, limit: clampLimit(params.get('limit'), months.length - startIndex) });
  }, [months]);

  const isComplete = view.limit >= months.length - view.startIndex;

  const revealNext = useCallback(() => {
    const limit = view.limit + 1;
    const params = new URLSearchParams(window.location.search);
    params.set('limit', String(limit));
    params.set('end', months[view.startIndex] ?? '');
    window.history.replaceState(null, '', `/memos?${params.toString()}`);
    setView({ ...view, limit });
  }, [months, view]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          revealNext();
        }
      },
      { rootMargin: '800px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [revealNext]);

  return (
    <>
      <MemoList>
        {groups.slice(view.startIndex, view.startIndex + view.limit).map(group => (
          <Fragment key={group.month}>{group.node}</Fragment>
        ))}
      </MemoList>
      {!isComplete && <div ref={sentinelRef} className="mt-8 h-1" aria-hidden="true" />}
    </>
  );
}
