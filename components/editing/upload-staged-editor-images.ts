'use client';

import { createAssetUploadAction } from '@/lib/actions/create-asset-upload';
import type { StagedEditorImage } from '@/lib/utils/editor-image';

interface IUploadStagedEditorImagesInput {
  content?: string;
  images: StagedEditorImage[];
}

const isReferencedByContent = (image: StagedEditorImage, content?: string) => {
  if (content === undefined) {
    return true;
  }

  return content.includes(image.key);
};

/** Upload one staged image straight to the assets bucket through a signed URL. */
export const uploadStagedEditorImage = async (image: Omit<StagedEditorImage, 'alt'>) => {
  const result = await createAssetUploadAction({
    scope: image.scope,
    entityId: image.uploadEntityId,
    imageId: image.imageId,
    size: image.blob.size,
    width: image.width,
    height: image.height,
    blur: image.blur,
  });

  if (!result.success || !result.data) {
    throw new Error(result.success ? 'Upload failed' : result.error);
  }
  // The content already points at `image.key`; storing the file anywhere else would leave
  // that reference dangling.
  if (result.data.key !== image.key) {
    throw new Error('Upload failed: unexpected image key');
  }

  const response = await fetch(result.data.uploadUrl, {
    method: 'PUT',
    headers: result.data.headers,
    body: image.blob,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
};

export const uploadStagedEditorImages = async ({
  content,
  images,
}: IUploadStagedEditorImagesInput) => {
  const uploadedKeys = new Set<string>();

  for (const image of images) {
    if (uploadedKeys.has(image.key) || !isReferencedByContent(image, content)) {
      continue;
    }

    await uploadStagedEditorImage(image);
    uploadedKeys.add(image.key);
  }
};
