import { cache } from 'react';
import { z } from 'zod';

import { fetchGitHubJson, fetchGitHubText, writeGitHubJson } from '@/lib/data/common';
import { deleteImages } from '@/lib/data/images';
import { formatTime } from '@/lib/dayjs';

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

const MEMOS_PATH = 'data/memos.json';

export const getMemos = cache(async (token?: string): Promise<MemoList> => {
  try {
    const raw = await fetchGitHubJson<unknown>(MEMOS_PATH, undefined, token).catch(() => []);
    const list = MemoListSchema.parse(raw ?? []);
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
  const rawText = await fetchGitHubText(MEMOS_PATH, undefined, input.token).catch(() => '[]');
  const raw = JSON.parse(rawText);
  const list = MemoListSchema.parse(raw ?? []);

  const memo: Memo = {
    id: input.id,
    content: input.content,
    images: input.images ?? [],
    createdTime: formatTime(),
  };

  const nextList: MemoList = [memo, ...list];

  await writeGitHubJson(MEMOS_PATH, nextList, 'docs: update memos.json', input.token);

  return memo;
};

interface IUpdateMemoInput {
  id: string;
  content: string;
  images?: string[];
  token?: string;
}

interface IUpdateMemoResult {
  memo: Memo;
  removedImages: string[];
}

export const updateMemo = async (input: IUpdateMemoInput): Promise<IUpdateMemoResult> => {
  const raw = await fetchGitHubJson<unknown>(MEMOS_PATH, undefined, input.token).catch(() => []);
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

  await writeGitHubJson(MEMOS_PATH, updatedList, 'docs: update memos.json', input.token);

  return { memo: updatedMemo, removedImages };
};

interface IDeleteMemoInput {
  id: string;
  token?: string;
}

export const deleteMemo = async (input: IDeleteMemoInput): Promise<Memo> => {
  const raw = await fetchGitHubJson<unknown>(MEMOS_PATH, undefined, input.token).catch(() => []);
  const list = MemoListSchema.parse(raw ?? []);

  const memoToDelete = list.find(m => m.id === input.id);
  if (!memoToDelete) {
    throw new Error('Memo not found');
  }

  const filteredList = list.filter(m => m.id !== input.id);

  await writeGitHubJson(MEMOS_PATH, filteredList, 'docs: update memos.json', input.token);

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
