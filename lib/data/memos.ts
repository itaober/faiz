import type { MDXRemoteSerializeResult } from 'next-mdx-remote';
import { cache } from 'react';
import { z } from 'zod';

import {
  fetchGitHubDir,
  fetchGitHubJson,
  fetchGitHubText,
  writeGitHubJson,
} from '@/lib/data/common';
import { deleteImages } from '@/lib/data/images';
import dayjs, { formatTime, TIMEZONE } from '@/lib/dayjs';

export const MemoSchema = z.object({
  id: z.string(),
  content: z.string(),
  images: z.array(z.string()).default([]),
  createdTime: z.string(),
  updatedTime: z.string().optional(),
});

export const MemoListSchema = z.array(MemoSchema);

export type Memo = z.infer<typeof MemoSchema>;
export type MemoList = z.infer<typeof MemoListSchema>;
export interface MemoRenderItem {
  memo: Memo;
  mdxSource: MDXRemoteSerializeResult<Record<string, unknown>>;
}

const MEMOS_DIR = 'data/memos';
const MEMOS_FILE_PREFIX = 'memos-';
const MEMOS_FILE_SUFFIX = '.json';

const buildMemosPath = (month: string) =>
  `${MEMOS_DIR}/${MEMOS_FILE_PREFIX}${month}${MEMOS_FILE_SUFFIX}`;

const parseMonthFromPath = (path: string) => {
  const filename = path.split('/').pop() ?? '';
  if (!filename.startsWith(MEMOS_FILE_PREFIX) || !filename.endsWith(MEMOS_FILE_SUFFIX)) {
    return null;
  }
  const month = filename.slice(
    MEMOS_FILE_PREFIX.length,
    filename.length - MEMOS_FILE_SUFFIX.length,
  );
  return /^\d{6}$/.test(month) ? month : null;
};

const getMemoMonthFromCreatedTime = (createdTime?: string) => {
  if (!createdTime) return null;
  const parsed = dayjs.tz(createdTime, TIMEZONE);
  if (!parsed.isValid()) return null;
  return parsed.format('YYYYMM');
};

const sortMemoList = (list: MemoList) =>
  [...list].sort((a, b) => b.createdTime.localeCompare(a.createdTime));

export const getMemosIndex = cache(async (token?: string): Promise<string[]> => {
  try {
    const files = await fetchGitHubDir(MEMOS_DIR, undefined, token);
    const months = files.map(parseMonthFromPath).filter((month): month is string => Boolean(month));
    return months.sort((a, b) => b.localeCompare(a));
  } catch (error) {
    console.error('Failed to fetch memos index:', error);
    return [];
  }
});

export const getMemosByMonth = async (month: string, token?: string): Promise<MemoList> => {
  if (!/^\d{6}$/.test(month)) return [];

  const path = buildMemosPath(month);
  const raw = await fetchGitHubJson<unknown>(path, undefined, token).catch(() => []);
  const list = MemoListSchema.parse(raw ?? []);
  return sortMemoList(list);
};

export const getMemosByMonths = async (months: string[], token?: string): Promise<MemoList> => {
  if (!months.length) return [];
  const results = await Promise.all(months.map(month => getMemosByMonth(month, token)));
  return results.flat();
};

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

interface ICreateMemoInput {
  id: string;
  content: string;
  images?: string[];
  token?: string;
}

export const prependMemo = async (input: ICreateMemoInput): Promise<Memo> => {
  const createdTime = formatTime();
  const memoMonth = getMemoMonthFromCreatedTime(createdTime);
  if (!memoMonth) {
    throw new Error('Invalid memo createdTime');
  }

  const memosPath = buildMemosPath(memoMonth);
  const rawText = await fetchGitHubText(memosPath, undefined, input.token).catch(() => '[]');
  const raw = JSON.parse(rawText);
  const list = MemoListSchema.parse(raw ?? []);

  const memo: Memo = {
    id: input.id,
    content: input.content,
    images: input.images ?? [],
    createdTime,
  };

  const nextList: MemoList = [memo, ...list];

  await writeGitHubJson(memosPath, nextList, `docs: update ${memosPath}`, input.token);

  return memo;
};

interface IUpdateMemoInput {
  id: string;
  content: string;
  images?: string[];
  createdTime: string;
  token?: string;
}

interface IUpdateMemoResult {
  memo: Memo;
  removedImages: string[];
}

export const updateMemo = async (input: IUpdateMemoInput): Promise<IUpdateMemoResult> => {
  const memoMonth = getMemoMonthFromCreatedTime(input.createdTime);
  if (!memoMonth) {
    throw new Error('Invalid memo createdTime');
  }

  const memosPath = buildMemosPath(memoMonth);
  const raw = await fetchGitHubJson<unknown>(memosPath, undefined, input.token).catch(() => []);
  const list = MemoListSchema.parse(raw ?? []);

  const memoIndex = list.findIndex(m => m.id === input.id);
  if (memoIndex === -1) {
    throw new Error('Memo not found');
  }

  const oldMemo = list[memoIndex];
  const newImages = input.images ?? oldMemo.images;

  const removedImages = oldMemo.images.filter(img => !newImages.includes(img));

  const updatedMemo: Memo = {
    ...oldMemo,
    content: input.content,
    images: newImages,
    updatedTime: formatTime(),
  };

  const updatedList = [...list];
  updatedList[memoIndex] = updatedMemo;

  await writeGitHubJson(memosPath, updatedList, `docs: update ${memosPath}`, input.token);

  return { memo: updatedMemo, removedImages };
};

interface IDeleteMemoInput {
  id: string;
  createdTime: string;
  token?: string;
}

export const deleteMemo = async (input: IDeleteMemoInput): Promise<Memo> => {
  const memoMonth = getMemoMonthFromCreatedTime(input.createdTime);
  if (!memoMonth) {
    throw new Error('Invalid memo createdTime');
  }

  const memosPath = buildMemosPath(memoMonth);
  const raw = await fetchGitHubJson<unknown>(memosPath, undefined, input.token).catch(() => []);
  const list = MemoListSchema.parse(raw ?? []);

  const memoToDelete = list.find(m => m.id === input.id);
  if (!memoToDelete) {
    throw new Error('Memo not found');
  }

  const filteredList = list.filter(m => m.id !== input.id);

  await writeGitHubJson(memosPath, filteredList, `docs: update ${memosPath}`, input.token);

  return memoToDelete;
};

/** Delete memo and cleanup associated images */
export const deleteMemoWithImages = async (input: IDeleteMemoInput): Promise<Memo> => {
  const deletedMemo = await deleteMemo(input);

  if (deletedMemo.images.length > 0 && input.token) {
    await deleteImages(deletedMemo.images, input.token);
  }

  return deletedMemo;
};

/** Update memo and cleanup removed images */
export const updateMemoWithImages = async (
  input: IUpdateMemoInput,
): Promise<{ memo: Memo; removedImages: string[] }> => {
  const result = await updateMemo(input);

  if (result.removedImages.length > 0 && input.token) {
    await deleteImages(result.removedImages, input.token);
  }

  return result;
};
