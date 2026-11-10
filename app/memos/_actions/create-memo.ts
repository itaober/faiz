'use server';

import { revalidatePath } from 'next/cache';

import { MAX_MEMO_CONTENT_LENGTH, normalizeImagePathList } from '@/lib/content-editing-validation';
import type { Memo } from '@/lib/data/memos';
import { prependMemo } from '@/lib/data/memos';
import { requireEditSession } from '@/lib/server/edit-session';
import { type ActionResult, createActionError, validationError } from '@/lib/types/action-result';

interface ICreateMemoInput {
  id: string;
  content: string;
  images?: string[];
}

export async function createMemoAction(input: ICreateMemoInput): Promise<ActionResult<Memo>> {
  const denied = await requireEditSession();
  if (denied) {
    return denied;
  }

  const content = typeof input.content === 'string' ? input.content : '';
  const normalizedImages = normalizeImagePathList(input.images ?? [], 'memos');
  if (normalizedImages.invalid.length > 0) {
    return validationError('Invalid memo image path');
  }

  // Allow memos with only images
  if (!content.trim() && normalizedImages.paths.length === 0) {
    return validationError('Content or images cannot be empty');
  }

  if (content.length > MAX_MEMO_CONTENT_LENGTH) {
    return validationError(`Content too long (max ${MAX_MEMO_CONTENT_LENGTH} characters)`);
  }

  try {
    const memo = await prependMemo({
      id: input.id,
      content: content.trim(),
      images: normalizedImages.paths,
    });

    revalidatePath('/memos');

    return { success: true, data: memo };
  } catch (error) {
    console.error('Failed to create memo:', error);
    return createActionError(error, 'Failed to create memo');
  }
}
