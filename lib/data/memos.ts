import { cache } from 'react';
import { z } from 'zod';

import { CONTENT_KEYS, memoMonthFromKey } from '@/lib/content-keys';
import { deleteImages } from '@/lib/data/images';
import dayjs, { formatTime, TIMEZONE } from '@/lib/dayjs';
import { NotFoundError, StorageError } from '@/lib/errors';
import {
  listContent,
  readContentJson,
  readContentJsonForUpdate,
  writeContentJson,
} from '@/lib/storage/r2';

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

const MEMOS_REVALIDATE_SECONDS = 60;

const getMemoMonthFromCreatedTime = (createdTime?: string) => {
  if (!createdTime) {
    return null;
  }
  const parsed = dayjs.tz(createdTime, TIMEZONE);
  if (!parsed.isValid()) {
    return null;
  }
  return parsed.format('YYYYMM');
};

const sortMemoList = (list: MemoList) =>
  [...list].sort((a, b) => b.createdTime.localeCompare(a.createdTime));

export const getMemosIndex = cache(async (): Promise<string[]> => {
  try {
    const keys = await listContent(CONTENT_KEYS.memosFolder, MEMOS_REVALIDATE_SECONDS);
    const months = keys.map(memoMonthFromKey).filter((month): month is string => Boolean(month));
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

  const raw = await readContentJson(CONTENT_KEYS.memos(month), MEMOS_REVALIDATE_SECONDS).catch(
    () => [],
  );
  const list = MemoListSchema.parse(raw ?? []);
  return sortMemoList(list);
};

export const getMemosByMonths = async (months: string[]): Promise<MemoList> => {
  if (!months.length) {
    return [];
  }
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
    const months = await getMemosIndex();
    const all = await getMemosByMonths(months);
    return all.find(memo => memo.id === id) ?? null;
  } catch (error) {
    console.error('Failed to fetch memo by id:', error);
    return null;
  }
});

export const getMemos = cache(async (): Promise<MemoList> => {
  try {
    const months = await getMemosIndex();
    const recentMonths = months.slice(0, 2);
    const list = await getMemosByMonths(recentMonths);
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
}

export const prependMemo = async (input: ICreateMemoInput): Promise<Memo> => {
  const createdTime = formatTime();
  const memoMonth = getMemoMonthFromCreatedTime(createdTime);
  if (!memoMonth) {
    throw new Error('Invalid memo createdTime');
  }

  const memosKey = CONTENT_KEYS.memos(memoMonth);
  // null on the first memo of a month: no revision means "create", which is right.
  const file = await readContentJsonForUpdate<unknown>(memosKey);
  const list = MemoListSchema.parse(file?.data ?? []);

  const memo: Memo = {
    id: input.id,
    content: input.content,
    images: input.images ?? [],
    createdTime,
  };

  const nextList: MemoList = [memo, ...list];

  await writeContentJson(memosKey, nextList, file?.revision ?? null);

  return memo;
};

interface IUpdateMemoInput {
  id: string;
  content: string;
  images?: string[];
  /** The images the editor loaded; removed images are deleted, so they must still be current. */
  originalImages: string[];
  createdTime: string;
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

  const memosKey = CONTENT_KEYS.memos(memoMonth);
  const file = await readContentJsonForUpdate<unknown>(memosKey);
  const list = MemoListSchema.parse(file?.data ?? []);

  const memoIndex = list.findIndex(m => m.id === input.id);
  if (memoIndex === -1) {
    throw new NotFoundError('Memo not found');
  }

  const oldMemo = list[memoIndex];
  // A stale editor would otherwise delete images added to this memo elsewhere since.
  if (oldMemo.images.join('\n') !== input.originalImages.join('\n')) {
    throw new StorageError(412, `Memo changed since it was loaded: ${input.id}`);
  }
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

  await writeContentJson(memosKey, updatedList, file?.revision ?? null);

  return { memo: updatedMemo, removedImages };
};

interface IDeleteMemoInput {
  id: string;
  createdTime: string;
}

export const deleteMemo = async (input: IDeleteMemoInput): Promise<Memo> => {
  const memoMonth = getMemoMonthFromCreatedTime(input.createdTime);
  if (!memoMonth) {
    throw new Error('Invalid memo createdTime');
  }

  const memosKey = CONTENT_KEYS.memos(memoMonth);
  const file = await readContentJsonForUpdate<unknown>(memosKey);
  const list = MemoListSchema.parse(file?.data ?? []);

  const memoToDelete = list.find(m => m.id === input.id);
  if (!memoToDelete) {
    throw new NotFoundError('Memo not found');
  }

  const filteredList = list.filter(m => m.id !== input.id);

  await writeContentJson(memosKey, filteredList, file?.revision ?? null);

  return memoToDelete;
};

/** Delete memo and cleanup associated images */
export const deleteMemoWithImages = async (input: IDeleteMemoInput): Promise<Memo> => {
  const deletedMemo = await deleteMemo(input);

  if (deletedMemo.images.length > 0) {
    await deleteImages(deletedMemo.images, 'memos');
  }

  return deletedMemo;
};

/** Update memo and cleanup removed images */
export const updateMemoWithImages = async (
  input: IUpdateMemoInput,
): Promise<{ memo: Memo; removedImages: string[] }> => {
  const result = await updateMemo(input);

  if (result.removedImages.length > 0) {
    await deleteImages(result.removedImages, 'memos');
  }

  return result;
};
