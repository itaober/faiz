'use server';

import { revalidatePath } from 'next/cache';

import { deleteMemoWithImages } from '@/lib/data/memos';
import { requireEditSession } from '@/lib/server/edit-session';
import { type ActionResult, createActionError } from '@/lib/types/action-result';

interface IDeleteMemoInput {
  id: string;
  createdTime: string;
}

export async function deleteMemoAction(input: IDeleteMemoInput): Promise<ActionResult> {
  const denied = await requireEditSession();
  if (denied) {
    return denied;
  }

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

  try {
    await deleteMemoWithImages({
      id: input.id,
      createdTime: input.createdTime,
    });
    revalidatePath('/memos');

    return { success: true };
  } catch (error) {
    console.error('Failed to delete memo:', error);
    return createActionError(error, 'Failed to delete memo');
  }
}
