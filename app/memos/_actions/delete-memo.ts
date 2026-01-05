'use server';

import { revalidatePath } from 'next/cache';

import { deleteMemoWithImages } from '@/lib/data/memos';

interface DeleteMemoInput {
  id: string;
  token: string;
}

export async function deleteMemoAction(input: DeleteMemoInput) {
  try {
    if (!input.id?.trim()) {
      return { success: false, error: 'Memo ID is required' };
    }

    if (!input.token?.trim()) {
      return { success: false, error: 'GitHub token is required' };
    }

    await deleteMemoWithImages({ id: input.id, token: input.token });
    revalidatePath('/memos');

    return { success: true };
  } catch (error) {
    console.error('Failed to delete memo:', error);

    if (error instanceof Error) {
      if (error.message === 'Memo not found') {
        return { success: false, error: 'Memo not found' };
      }
      if (error.message.includes('401')) {
        return { success: false, error: 'Invalid GitHub token' };
      }
      if (error.message.includes('403')) {
        return {
          success: false,
          error: 'GitHub API rate limit exceeded or insufficient permissions',
        };
      }
      if (error.message.includes('404')) {
        return { success: false, error: 'Repository not found or insufficient permissions' };
      }
    }

    return { success: false, error: 'Failed to delete memo' };
  }
}
