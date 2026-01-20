'use server';

import { revalidatePath } from 'next/cache';

import type { Memo } from '@/lib/data/memos';
import { prependMemo } from '@/lib/data/memos';
import { type ActionResult, createActionError } from '@/lib/types/action-result';

interface ICreateMemoInput {
  id: string;
  content: string;
  images?: string[];
  token: string;
}

const MAX_CONTENT_LENGTH = 10000;

export async function createMemoAction(input: ICreateMemoInput): Promise<ActionResult<Memo>> {
  // Allow memos with only images
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
    const memo = await prependMemo({
      id: input.id,
      content: input.content?.trim() || '',
      images: input.images,
      token: input.token,
    });

    revalidatePath('/memos');

    return { success: true, data: memo };
  } catch (error) {
    console.error('Failed to create memo:', error);
    return createActionError(error, 'Failed to create memo');
  }
}
