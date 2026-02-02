import 'server-only';

import { serialize } from 'next-mdx-remote/serialize';

import type { Memo, MemoRenderItem } from '@/lib/data/memos';

export const toMemoRenderItem = async (memo: Memo): Promise<MemoRenderItem> => {
  const mdxSource = await serialize(memo.content || '');
  return { memo, mdxSource };
};

export const toMemoRenderItems = async (memos: Memo[]): Promise<MemoRenderItem[]> =>
  Promise.all(memos.map(toMemoRenderItem));
