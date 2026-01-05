'use server';

import { revalidatePath } from 'next/cache';

import { updateMemoWithImages } from '@/lib/data/memos';

interface UpdateMemoInput {
  id: string;
  content: string;
  images?: string[];
  token: string;
}

const MAX_CONTENT_LENGTH = 10000;

export async function updateMemoAction(input: UpdateMemoInput) {
  try {
    if (!input.id?.trim()) {
      return { success: false, error: 'Memo ID is required' };
    }

    if (!input.content?.trim() && (!input.images || input.images.length === 0)) {
      return { success: false, error: 'Content or images cannot be empty' };
    }

    if (input.content && input.content.length > MAX_CONTENT_LENGTH) {
      return { success: false, error: `Content too long (max ${MAX_CONTENT_LENGTH} characters)` };
    }

    if (!input.token?.trim()) {
      return { success: false, error: 'GitHub token is required' };
    }

    const { memo } = await updateMemoWithImages({
      id: input.id,
      content: input.content?.trim() || '',
      images: input.images,
      token: input.token,
    });

    revalidatePath('/memos');

    return { success: true, memo };
  } catch (error) {
    console.error('Failed to update memo:', error);

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

    return { success: false, error: 'Failed to update memo' };
  }
}
