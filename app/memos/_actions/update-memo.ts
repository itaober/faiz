'use server';

import { revalidatePath } from 'next/cache';

import type { Memo } from '@/lib/data/memos';
import { updateMemoWithImages } from '@/lib/data/memos';
import { type ActionResult, createActionError } from '@/lib/types/action-result';

interface IUpdateMemoInput {
  id: string;
  content: string;
  images?: string[];
  createdTime: string;
  token: string;
}

const MAX_CONTENT_LENGTH = 10000;

export async function updateMemoAction(input: IUpdateMemoInput): Promise<ActionResult<Memo>> {
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

  if (!input.content?.trim() && (!input.images || input.images.length === 0)) {
    return {
      success: false,
      error: 'Content or images cannot be empty',
      code: 'VALIDATION',
      retryable: false,
    };
  }

  if (input.content && input.content.length > MAX_CONTENT_LENGTH) {
    return {
      success: false,
      error: `Content too long (max ${MAX_CONTENT_LENGTH} characters)`,
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
    const { memo } = await updateMemoWithImages({
      id: input.id,
      content: input.content?.trim() || '',
      images: input.images,
      createdTime: input.createdTime,
      token: input.token,
    });

    revalidatePath('/memos');

    return { success: true, data: memo };
  } catch (error) {
    console.error('Failed to update memo:', error);

    if (error instanceof Error && error.message === 'Memo not found') {
      return {
        success: false,
        error: 'Memo not found',
        code: 'NOT_FOUND',
        retryable: false,
      };
    }

    return createActionError(error, 'Failed to update memo');
  }
}
