'use client';

import { uploadEditorImageAction } from '@/lib/edit-api';
import type { StagedEditorImage } from '@/lib/utils/editor-image';

interface IUploadStagedEditorImagesInput {
  content?: string;
  images: StagedEditorImage[];
  token: string;
}

const isReferencedByContent = (image: StagedEditorImage, content?: string) => {
  if (content === undefined) {
    return true;
  }

  return content.includes(image.src) || content.includes(image.path);
};

export const uploadStagedEditorImages = async ({
  content,
  images,
  token,
}: IUploadStagedEditorImagesInput) => {
  const uploadedPaths = new Set<string>();

  for (const image of images) {
    if (uploadedPaths.has(image.path) || !isReferencedByContent(image, content)) {
      continue;
    }

    const result = await uploadEditorImageAction({
      imageBase64: image.imageBase64,
      mimeType: image.mimeType,
      scope: image.scope,
      entityId: image.uploadEntityId,
      imageId: image.imageId,
      token,
    });

    if (!result.success || !result.data) {
      throw new Error(result.success ? 'Upload failed' : result.error);
    }

    uploadedPaths.add(image.path);
  }
};
