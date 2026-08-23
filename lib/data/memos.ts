import { cache } from 'react';

import { fetchGitHubDir, fetchGitHubJson } from '@/lib/data/common';

import {
  buildMemosPath,
  MEMOS_DIR,
  type Memo,
  type MemoList,
  MemoListSchema,
  parseMonthFromPath,
  sortMemoList,
} from './memos-shared';

export * from './memos-shared';
export * from './memos-write';

const MEMOS_REVALIDATE_SECONDS = 60;

const MEMOS_FETCH_INIT: RequestInit = {
  next: {
    revalidate: MEMOS_REVALIDATE_SECONDS,
  },
};

export const getMemosIndex = cache(async (token?: string): Promise<string[]> => {
  try {
    const files = await fetchGitHubDir(MEMOS_DIR, MEMOS_FETCH_INIT, token);
    const months = files.map(parseMonthFromPath).filter((month): month is string => Boolean(month));
    return months.sort((a, b) => b.localeCompare(a));
  } catch (error) {
    console.error('Failed to fetch memos index:', error);
    return [];
  }
});

export const getMemosByMonth = async (month: string, token?: string): Promise<MemoList> => {
  if (!/^\d{6}$/.test(month)) {
    return [];
  }

  const path = buildMemosPath(month);
  const raw = await fetchGitHubJson<unknown>(path, MEMOS_FETCH_INIT, token).catch(() => []);
  const list = MemoListSchema.parse(raw ?? []);
  return sortMemoList(list);
};

export const getMemosByMonths = async (months: string[], token?: string): Promise<MemoList> => {
  if (!months.length) {
    return [];
  }
  const results = await Promise.all(months.map(month => getMemosByMonth(month, token)));
  return results.flat();
};

/**
 * Resolve a single memo by id for its permalink page. The id doesn't encode the
 * month, so we scan all month files (each cached individually) and find it —
 * no change to the stored memo structure.
 */
export const getMemoById = cache(async (id: string, token?: string): Promise<Memo | null> => {
  try {
    const months = await getMemosIndex(token);
    const all = await getMemosByMonths(months, token);
    return all.find(memo => memo.id === id) ?? null;
  } catch (error) {
    console.error('Failed to fetch memo by id:', error);
    return null;
  }
});

export const getMemos = cache(async (token?: string): Promise<MemoList> => {
  try {
    const months = await getMemosIndex(token);
    const recentMonths = months.slice(0, 2);
    const list = await getMemosByMonths(recentMonths, token);
    return list;
  } catch (error) {
    console.error('Failed to fetch memos list:', error);
    return [];
  }
});
