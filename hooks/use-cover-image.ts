'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { uploadStagedEditorImage } from '@/components/editing/upload-staged-editor-images';
import { resolveAssetSrc } from '@/lib/assets';
import { buildAssetKey, coverImageId, generateEditorImageId } from '@/lib/utils/editor-image';
import { compressImage, isSupportedImageType, MAX_SOURCE_IMAGE_SIZE } from '@/lib/utils/image';

/**
 * Cover-image staging for the records side panel: holds a pending file plus its
 * object-URL preview, and uploads it (compressed → WebP) on save. The object URL
 * is revoked automatically whenever it changes or the panel unmounts.
 */
export function useCoverImage(initialCoverUrl: string) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // Assets are cached as immutable, so a replaced cover must never reuse a key: each picked file
  // gets its own suffix after the readable name.
  const [uploadId, setUploadId] = useState('');

  const coverPreviewSrc = previewUrl || (initialCoverUrl && resolveAssetSrc(initialCoverUrl));
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
    if (file.size > MAX_SOURCE_IMAGE_SIZE) {
      toast.error(`File too large (max ${MAX_SOURCE_IMAGE_SIZE / 1024 / 1024}MB): ${file.name}`);
      return;
    }
    setPendingFile(file);
    setUploadId(generateEditorImageId());
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  /** Key the staged cover will be stored at, for showing before the upload. */
  const coverKey = useCallback(
    (entityId: string, name: string) =>
      buildAssetKey({ entityId, imageId: coverImageId(name, uploadId), scope: 'records' }),
    [uploadId],
  );

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

  /** Upload the staged cover (if any), returning the value to store in `coverUrl`. */
  const uploadCover = useCallback(
    async (entityId: string, name: string): Promise<string> => {
      if (!pendingFile) {
        return initialCoverUrl;
      }
      const imageId = coverImageId(name, uploadId);
      const key = buildAssetKey({ entityId, imageId, scope: 'records' });
      await uploadStagedEditorImage({
        ...(await compressImage(pendingFile)),
        imageId,
        key,
        scope: 'records',
        uploadEntityId: entityId,
      });
      return key;
    },
    [initialCoverUrl, pendingFile, uploadId],
  );

  return {
    coverPreviewSrc,
    hasCover,
    pendingFile,
    stageCoverFile,
    clearPendingCover,
    coverKey,
    uploadCover,
  };
}
