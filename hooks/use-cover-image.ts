'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { uploadEditorImageAction } from '@/lib/edit-api';
import { toApiImageUrl } from '@/lib/utils/editor-image';
import {
  compressImage,
  fileToBase64,
  isSupportedImageType,
  MAX_IMAGE_SIZE,
} from '@/lib/utils/image';

/**
 * Cover-image staging for the records side panel: holds a pending file plus its
 * object-URL preview, and uploads it (compressed → WebP) on save. The object URL
 * is revoked automatically whenever it changes or the panel unmounts.
 */
export function useCoverImage(initialCoverUrl: string) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const coverPreviewSrc = previewUrl || initialCoverUrl;
  const hasCover = !!(coverPreviewSrc.trim() || pendingFile);

  // Revoke the previous object URL when it changes (and on unmount).
  useEffect(() => {
    if (!previewUrl) {
      return;
    }
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const clearPendingCover = useCallback(() => {
    setPreviewUrl('');
    setPendingFile(null);
  }, []);

  const stageCoverFile = useCallback((file: File) => {
    if (!isSupportedImageType(file.type)) {
      toast.error(`Unsupported format: ${file.name}`);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(`File too large: ${file.name}`);
      return;
    }
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  // Paste an image anywhere in the panel to set the cover.
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find(item =>
        item.type.startsWith('image/'),
      );
      if (file) {
        event.preventDefault();
        stageCoverFile(file);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [stageCoverFile]);

  /** Upload the staged cover (if any), returning the stored URL to persist. */
  const uploadCover = useCallback(
    async (entityId: string, imageId: string, token: string): Promise<string> => {
      if (!pendingFile) {
        return initialCoverUrl;
      }
      const compressed = await compressImage(pendingFile);
      const imageBase64 = await fileToBase64(compressed);
      const result = await uploadEditorImageAction({
        imageBase64,
        mimeType: 'image/webp',
        scope: 'records',
        entityId,
        imageId,
        token,
      });
      if (!result.success || !result.data) {
        throw new Error(result.success ? 'Upload failed' : result.error);
      }
      return toApiImageUrl(result.data);
    },
    [initialCoverUrl, pendingFile],
  );

  return {
    coverPreviewSrc,
    hasCover,
    pendingFile,
    stageCoverFile,
    clearPendingCover,
    uploadCover,
  };
}
