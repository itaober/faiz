'use server';

import type { MemoRenderItem } from '@/lib/data/memos';
import { getMemosByMonth } from '@/lib/data/memos';
import { toMemoRenderItems } from '@/lib/data/memos-render';
import { type ActionResult, createActionError } from '@/lib/types/action-result';

interface ILoadMoreMemosInput {
  month: string;
}

export async function loadMoreMemosAction(
  input: ILoadMoreMemosInput,
): Promise<ActionResult<MemoRenderItem[]>> {
  if (!input.month?.trim()) {
    return {
      success: false,
      error: 'Month is required',
      code: 'VALIDATION',
      retryable: false,
    };
  }

  if (!/^\d{6}$/.test(input.month)) {
    return {
      success: false,
      error: 'Invalid month format',
      code: 'VALIDATION',
      retryable: false,
    };
  }

  try {
    const memos = await getMemosByMonth(input.month);
    const items = await toMemoRenderItems(memos);
    return { success: true, data: items };
  } catch (error) {
    console.error('Failed to load more memos:', error);
    return createActionError(error, 'Failed to load more memos');
  }
}
