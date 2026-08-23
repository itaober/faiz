import { formatTime } from '@/lib/dayjs';
import { NotFoundError } from '@/lib/errors';

import { fetchGitHubJsonWithSha, writeGitHubJson } from './github';
import { deleteImages } from './images';
import {
  buildMemosPath,
  getMemoMonthFromCreatedTime,
  type Memo,
  type MemoList,
  MemoListSchema,
} from './memos-shared';

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
  // null on the first memo of a month: no SHA means "create", which is right.
  const file = await fetchGitHubJsonWithSha<unknown>(memosPath, input.token);
  const list = MemoListSchema.parse(file?.data ?? []);

  const memo: Memo = {
    id: input.id,
    content: input.content,
    images: input.images ?? [],
    createdTime,
  };

  const nextList: MemoList = [memo, ...list];

  await writeGitHubJson(memosPath, nextList, `docs: update ${memosPath}`, input.token, file?.sha);

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
  const file = await fetchGitHubJsonWithSha<unknown>(memosPath, input.token);
  const list = MemoListSchema.parse(file?.data ?? []);

  const memoIndex = list.findIndex(m => m.id === input.id);
  if (memoIndex === -1) {
    throw new NotFoundError('Memo not found');
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

  await writeGitHubJson(
    memosPath,
    updatedList,
    `docs: update ${memosPath}`,
    input.token,
    file?.sha,
  );

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
  const file = await fetchGitHubJsonWithSha<unknown>(memosPath, input.token);
  const list = MemoListSchema.parse(file?.data ?? []);

  const memoToDelete = list.find(m => m.id === input.id);
  if (!memoToDelete) {
    throw new NotFoundError('Memo not found');
  }

  const filteredList = list.filter(m => m.id !== input.id);

  await writeGitHubJson(
    memosPath,
    filteredList,
    `docs: update ${memosPath}`,
    input.token,
    file?.sha,
  );

  return memoToDelete;
};

/** Delete memo and cleanup associated images */
export const deleteMemoWithImages = async (input: IDeleteMemoInput): Promise<Memo> => {
  const deletedMemo = await deleteMemo(input);

  if (deletedMemo.images.length > 0 && input.token) {
    await deleteImages(deletedMemo.images, input.token, 'memos');
  }

  return deletedMemo;
};

/** Update memo and cleanup removed images */
export const updateMemoWithImages = async (
  input: IUpdateMemoInput,
): Promise<{ memo: Memo; removedImages: string[] }> => {
  const result = await updateMemo(input);

  if (result.removedImages.length > 0 && input.token) {
    await deleteImages(result.removedImages, input.token, 'memos');
  }

  return result;
};
