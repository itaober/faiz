'use server';

import { revalidatePath } from 'next/cache';

import { deleteMemoWithImages } from '@/lib/data/memos';
import { type ActionResult, createActionError } from '@/lib/types/action-result';

interface IDeleteMemoInput {
  id: string;
  createdTime: string;
  token: string;
}

export async function deleteMemoAction(input: IDeleteMemoInput): Promise<ActionResult> {
  if (!input.id?.trim()) {
    return {
      success: false,
      error: 'Memo ID is required',
      code: 'VALIDATION',
      retryable: false,
    };
  }

  if (!input.createdTime?.trim()) {
    return {
      success: false,
      error: 'Memo createdTime is required',
      code: 'VALIDATION',
      retryable: false,
    };
  }

  if (!input.token?.trim()) {
    return {
      success: false,
      error: 'GitHub token is required',
      code: 'AUTH_INVALID',
      retryable: false,
    };
  }

  try {
    await deleteMemoWithImages({
      id: input.id,
      createdTime: input.createdTime,
      token: input.token,
    });
    revalidatePath('/memos');

    return { success: true };
  } catch (error) {
    console.error('Failed to delete memo:', error);

    if (error instanceof Error && error.message === 'Memo not found') {
      return {
        success: false,
        error: 'Memo not found',
        code: 'NOT_FOUND',
        retryable: false,
      };
    }

    return createActionError(error, 'Failed to delete memo');
  }
}
