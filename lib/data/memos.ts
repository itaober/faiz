import { cache } from 'react';
import { z } from 'zod';

import { fetchGitHubJson, fetchGitHubText, generateId, writeGitHubJson } from '@/lib/data/common';
// ============================================================
// Composite functions (with image cleanup)
// ============================================================
import { deleteImages } from '@/lib/data/images';

export const MemoSchema = z.object({
  id: z.string(),
  content: z.string(),
  images: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const MemoListSchema = z.array(MemoSchema);

export type Memo = z.infer<typeof MemoSchema>;
export type MemoList = z.infer<typeof MemoListSchema>;

const MEMOS_PATH = 'data/memos.json';

export const getMemos = cache(async (token?: string): Promise<MemoList> => {
  try {
    const raw = await fetchGitHubJson<unknown>(MEMOS_PATH, undefined, token).catch(() => []);
    const list = MemoListSchema.parse(raw ?? []);

    // 由于新 memo 总是插入到头部，不需要再次排序
    return list;
  } catch (error) {
    console.error('Failed to fetch memos list:', error);
    return [];
  }
});

interface ICreateMemoInput {
  content: string;
  images?: string[];
  token?: string;
}

export const prependMemo = async (input: ICreateMemoInput): Promise<Memo> => {
  // 获取当前最新的 memos.json 内容
  // 使用 fetchGitHubText 而不是 fetchGitHubJson，确保与写入时使用相同的 API
  const rawText = await fetchGitHubText(MEMOS_PATH, undefined, input.token).catch(() => '[]');
  const raw = JSON.parse(rawText);
  const list = MemoListSchema.parse(raw ?? []);

  const id = generateId('memo');

  const memo: Memo = {
    id,
    content: input.content,
    images: input.images ?? [],
    createdAt: new Date().toISOString(),
  };

  // 将新增的内容插入到头部
  const nextList: MemoList = [memo, ...list];

  // 调用 GitHub API 修改整个 memos.json 文件
  await writeGitHubJson(MEMOS_PATH, nextList, 'docs: update memos.json', input.token);

  return memo;
};

// 更新 memo
interface IUpdateMemoInput {
  id: string;
  content: string;
  images?: string[];
  token?: string;
}

interface IUpdateMemoResult {
  memo: Memo;
  /** 被移除的图片路径（用于清理） */
  removedImages: string[];
}

export const updateMemo = async (input: IUpdateMemoInput): Promise<IUpdateMemoResult> => {
  // 获取当前 memos 列表
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
    updatedAt: new Date().toISOString(),
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
