'use server';

import { revalidatePath } from 'next/cache';

import { normalizeImagePathList } from '@/lib/content-editing-validation';
import type { Memo } from '@/lib/data/memos';
import { prependMemo } from '@/lib/data/memos';
import { requireAuth } from '@/lib/server/content-edit-token';
import { type ActionResult, createActionError } from '@/lib/types/action-result';

interface ICreateMemoInput {
  id: string;
  content: string;
  images?: string[];
  token: string;
}

const MAX_CONTENT_LENGTH = 10000;

export async function createMemoAction(input: ICreateMemoInput): Promise<ActionResult<Memo>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  const content = typeof input.content === 'string' ? input.content : '';
  const normalizedImages = normalizeImagePathList(input.images ?? [], 'memos');
  if (normalizedImages.invalid.length > 0) {
    return {
      success: false,
      error: 'Invalid memo image path',
      code: 'VALIDATION',
      retryable: false,
    };
  }

  // Allow memos with only images
  if (!content.trim() && normalizedImages.paths.length === 0) {
    return {
      success: false,
      error: 'Content or images cannot be empty',
      code: 'VALIDATION',
      retryable: false,
    };
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return {
      success: false,
      error: `Content too long (max ${MAX_CONTENT_LENGTH} characters)`,
      code: 'VALIDATION',
      retryable: false,
    };
  }

  try {
    const memo = await prependMemo({
      id: input.id,
      content: content.trim(),
      images: normalizedImages.paths,
      token,
    });

    revalidatePath('/memos');

    return { success: true, data: memo };
  } catch (error) {
    console.error('Failed to create memo:', error);
    return createActionError(error, 'Failed to create memo');
  }
}
