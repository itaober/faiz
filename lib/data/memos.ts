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

export const getMemosIndex = cache(async (): Promise<string[]> => {
  try {
    const files = await fetchGitHubDir(MEMOS_DIR);
    const months = files.map(parseMonthFromPath).filter((month): month is string => Boolean(month));
    return months.sort((a, b) => b.localeCompare(a));
  } catch (error) {
    console.error('Failed to fetch memos index:', error);
    return [];
  }
});

export const getMemosByMonth = async (month: string): Promise<MemoList> => {
  if (!/^\d{6}$/.test(month)) {
    return [];
  }

  const raw = await fetchGitHubJson<unknown>(buildMemosPath(month)).catch(() => []);
  return sortMemoList(MemoListSchema.parse(raw ?? []));
};

export const getMemosByMonths = async (months: string[]): Promise<MemoList> => {
  const results = await Promise.all(months.map(month => getMemosByMonth(month)));
  return results.flat();
};

/**
 * Resolve a single memo by id for its permalink page. The id doesn't encode the
 * month, so we scan all month files (each cached individually) and find it —
 * no change to the stored memo structure.
 */
export const getMemoById = cache(async (id: string): Promise<Memo | null> => {
  try {
    const all = await getMemosByMonths(await getMemosIndex());
    return all.find(memo => memo.id === id) ?? null;
  } catch (error) {
    console.error('Failed to fetch memo by id:', error);
    return null;
  }
});

export const getMemos = cache(async (): Promise<MemoList> => {
  try {
    const months = await getMemosIndex();
    return await getMemosByMonths(months.slice(0, 2));
  } catch (error) {
    console.error('Failed to fetch memos list:', error);
    return [];
  }
});
