'use server';

import { revalidatePath } from 'next/cache';

import { uploadImage } from '@/lib/data/images';
import { getImageStoragePath } from '@/lib/utils/image';

const MEMOS_IMAGE_DIR = 'assets/memos';

/** Generate 4-character random string */
const generateShortRandom = () => Math.random().toString(36).slice(2, 6);

interface UploadImageInput {
  imageBase64: string;
  mimeType: string;
  memoId: string;
  token: string;
}

interface UploadImageResult {
  success: boolean;
  path?: string;
  error?: string;
}

export async function uploadImageAction(input: UploadImageInput): Promise<UploadImageResult> {
  try {
    if (!input.token?.trim()) {
      return { success: false, error: 'GitHub token is required' };
    }

    // Generate filename: {memoId}_{4-char random}.webp
    const filename = `${input.memoId}_${generateShortRandom()}.webp`;
    const storagePath = getImageStoragePath(filename, MEMOS_IMAGE_DIR);

    const result = await uploadImage({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      storagePath,
      token: input.token,
    });

    revalidatePath('/memos');

    return { success: true, path: result.path };
  } catch (error) {
    console.error('Failed to upload image:', error);

    if (error instanceof Error) {
      if (error.message.includes('401')) {
        return { success: false, error: 'Invalid GitHub token' };
      }
      if (error.message.includes('403')) {
        return {
          success: false,
          error: 'GitHub API rate limit exceeded or insufficient permissions',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: false, error: 'Failed to upload image' };
  }
}

export async function uploadImagesAction(
  images: Array<{ imageBase64: string; mimeType: string }>,
  memoId: string,
  token: string,
): Promise<{ success: boolean; paths: string[]; errors: string[] }> {
  const paths: string[] = [];
  const errors: string[] = [];

  // Sequential upload to avoid GitHub API conflicts
  for (const img of images) {
    const result = await uploadImageAction({ ...img, memoId, token });
    if (result.success && result.path) {
      paths.push(result.path);
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  return { success: errors.length === 0, paths, errors };
}
