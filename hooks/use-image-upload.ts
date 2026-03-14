'use client';

import { useCallback, useState } from 'react';

import { uploadImageAction } from '@/app/memos/_actions/upload-image';
import { compressImage } from '@/lib/utils/image';

interface IPendingImage {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  path?: string;
  error?: string;
}

interface IUseImageUploadOptions {
  maxCount?: number;
  token: string;
}

interface IUseImageUploadReturn {
  images: IPendingImage[];
  uploadedPaths: string[];
  isUploading: boolean;
  addImages: (files: FileList | File[]) => Promise<void>;
  removeImage: (id: string) => void;
  uploadAll: (memoId: string) => Promise<{ success: boolean; paths: string[]; errors: string[] }>;
  clear: () => void;
  setInitialImages: (paths: string[]) => void;
}

type UploadResult =
  | { id: string; success: true; path: string }
  | { id: string; success: false; error: string };

const generateId = () => `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Process a single file: compress and convert to WebP */
async function processFile(file: File): Promise<File> {
  return compressImage(file);
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to encode image'));
        return;
      }

      const base64 = reader.result.split(',')[1];
      if (!base64) {
        reject(new Error('Invalid image data'));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };

    reader.readAsDataURL(file);
  });
};

export function useImageUpload(options: IUseImageUploadOptions): IUseImageUploadReturn {
  const { maxCount = 9, token } = options;

  const [images, setImages] = useState<IPendingImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addImages = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remainingSlots = maxCount - images.length;

      if (remainingSlots <= 0) {
        return;
      }

      const filesToProcess = fileArray.slice(0, remainingSlots);
      const results = await Promise.allSettled(filesToProcess.map(processFile));

      const newImages: IPendingImage[] = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          const file = result.value;
          return {
            id: generateId(),
            file,
            preview: URL.createObjectURL(file),
            status: 'pending' as const,
          };
        }

        const file = filesToProcess[index];
        return {
          id: generateId(),
          file,
          preview: URL.createObjectURL(file),
          status: 'error' as const,
          error: result.reason?.message || 'Image compression failed',
        };
      });

      setImages(prev => [...prev, ...newImages]);
    },
    [images.length, maxCount],
  );

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image?.preview.startsWith('blob:')) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  }, []);

  const uploadAll = useCallback(
    async (memoId: string) => {
      const pendingImages = images.filter(img => img.status === 'pending');
      if (pendingImages.length === 0) {
        const successPaths = images
          .filter(img => img.status === 'success' && img.path)
          .map(img => img.path!);
        return { success: true, paths: successPaths, errors: [] };
      }

      setIsUploading(true);
      setImages(prev =>
        prev.map(img =>
          img.status === 'pending' ? { ...img, status: 'uploading' as const } : img,
        ),
      );

      try {
        const uploadResults = await Promise.all(
          pendingImages.map(async img => {
            try {
              const imageBase64 = await fileToBase64(img.file);
              const result = await uploadImageAction({
                imageBase64,
                mimeType: 'image/webp',
                memoId,
                token,
                skipRevalidate: true,
              });

              if (result.success && result.data) {
                return { id: img.id, success: true, path: result.data } as UploadResult;
              }

              const errorMessage = result.success
                ? 'Upload failed'
                : result.error || 'Upload failed';
              return {
                id: img.id,
                success: false,
                error: errorMessage,
              } as UploadResult;
            } catch (error) {
              return {
                id: img.id,
                success: false,
                error: error instanceof Error ? error.message : String(error),
              } as UploadResult;
            }
          }),
        );

        const resultMap = new Map(uploadResults.map(result => [result.id, result]));

        setImages(prev =>
          prev.map(img => {
            const result = resultMap.get(img.id);
            if (!result) {
              return img;
            }

            if (result.success) {
              return { ...img, status: 'success', path: result.path, error: undefined };
            }

            return { ...img, status: 'error', error: result.error };
          }),
        );

        const errors = uploadResults
          .filter(result => !result.success)
          .map(result => (result.success ? '' : result.error));

        const existingSuccessPaths = images
          .filter(img => img.status === 'success' && img.path)
          .map(img => img.path!);
        const currentSuccessPaths = uploadResults
          .filter(result => result.success)
          .map(result => (result.success ? result.path : ''));

        return {
          success: errors.length === 0,
          paths: [...existingSuccessPaths, ...currentSuccessPaths],
          errors,
        };
      } finally {
        setIsUploading(false);
      }
    },
    [images, token],
  );

  const clear = useCallback(() => {
    setImages(prev => {
      for (const img of prev) {
        if (img.preview.startsWith('blob:')) {
          URL.revokeObjectURL(img.preview);
        }
      }
      return [];
    });
  }, []);

  const setInitialImages = useCallback((paths: string[]) => {
    const initialImages: IPendingImage[] = paths.map(path => ({
      id: generateId(),
      file: new File([], path.split('/').pop() || 'image'),
      preview: path,
      status: 'success' as const,
      path,
    }));
    setImages(initialImages);
  }, []);

  const uploadedPaths = images
    .filter(img => img.status === 'success' && img.path)
    .map(img => img.path!);

  return {
    images,
    uploadedPaths,
    isUploading,
    addImages,
    removeImage,
    uploadAll,
    clear,
    setInitialImages,
  };
}
