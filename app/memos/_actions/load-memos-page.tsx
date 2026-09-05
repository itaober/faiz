'use server';

import { getMemosByMonths, getMemosIndex } from '@/lib/data/memos';

import MemoCard from '../_components/memo-card';
import MemoItemWrapper from '../_components/memo-item-wrapper';

export interface LoadedMemosPage {
  items: React.ReactNode;
  nextOffset: number | null;
}

/**
 * Server-rendered "load more" page: returns the next month's memos as RSC
 * nodes so the list route can stay static while pagination happens client-side.
 * MDX stays server-compiled — the client only appends the rendered nodes.
 */
export async function loadMemosPageAction(offset: number): Promise<LoadedMemosPage> {
  const months = await getMemosIndex();
  const index = Number.isInteger(offset) ? offset : -1;
  if (index < 0 || index >= months.length) {
    return { items: null, nextOffset: null };
  }

  const month = months[index];
  const memos = await getMemosByMonths([month]);

  return {
    items: memos.map(memo => (
      <MemoItemWrapper key={memo.id}>
        <MemoCard memo={memo} />
      </MemoItemWrapper>
    )),
    nextOffset: index + 1 < months.length ? index + 1 : null,
  };
}
