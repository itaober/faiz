'use server';

import { revalidatePath } from 'next/cache';

import { uploadImage } from '@/lib/data/images';
import { generateImageFilename, getImageStoragePath } from '@/lib/utils/image';

const MEMOS_IMAGE_DIR = 'assets/memos';

interface UploadImageInput {
  imageBase64: string;
  mimeType: string;
  id?: string;
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

    const filename = input.id || generateImageFilename('memo');

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

const BATCH_SIZE = 3;

export async function uploadImagesAction(
  images: Array<{ imageBase64: string; mimeType: string }>,
  token: string,
  id?: string,
): Promise<{ success: boolean; paths: string[]; errors: string[] }> {
  const paths: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(img => uploadImageAction({ ...img, token, id })));

    for (const result of results) {
      if (result.success && result.path) {
        paths.push(result.path);
      } else if (result.error) {
        errors.push(result.error);
      }
    }
  }

  return { success: errors.length === 0, paths, errors };
}
