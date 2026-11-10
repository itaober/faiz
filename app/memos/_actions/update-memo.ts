'use server';

import { revalidatePath } from 'next/cache';

import { MAX_MEMO_CONTENT_LENGTH, normalizeImagePathList } from '@/lib/content-editing-validation';
import type { Memo } from '@/lib/data/memos';
import { updateMemoWithImages } from '@/lib/data/memos';
import { requireEditSession } from '@/lib/server/edit-session';
import { type ActionResult, createActionError, validationError } from '@/lib/types/action-result';

interface IUpdateMemoInput {
  id: string;
  content: string;
  images?: string[];
  createdTime: string;
}

export async function updateMemoAction(input: IUpdateMemoInput): Promise<ActionResult<Memo>> {
  const denied = await requireEditSession();
  if (denied) {
    return denied;
  }

  const content = typeof input.content === 'string' ? input.content : '';
  const normalizedImages =
    input.images === undefined ? null : normalizeImagePathList(input.images, 'memos');

  if (normalizedImages && normalizedImages.invalid.length > 0) {
    return validationError('Invalid memo image path');
  }

  if (!input.id?.trim()) {
    return validationError('Memo ID is required');
  }

  if (!input.createdTime?.trim()) {
    return validationError('Memo createdTime is required');
  }

  if (!content.trim() && (!normalizedImages || normalizedImages.paths.length === 0)) {
    return validationError('Content or images cannot be empty');
  }

  if (content.length > MAX_MEMO_CONTENT_LENGTH) {
    return validationError(`Content too long (max ${MAX_MEMO_CONTENT_LENGTH} characters)`);
  }

  try {
    const { memo } = await updateMemoWithImages({
      id: input.id,
      content: content.trim(),
      images: normalizedImages?.paths,
      createdTime: input.createdTime,
    });

    revalidatePath('/memos');

    return { success: true, data: memo };
  } catch (error) {
    console.error('Failed to update memo:', error);
    return createActionError(error, 'Failed to update memo');
  }
}
