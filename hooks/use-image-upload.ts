'use client';

import { useCallback, useState } from 'react';

import { uploadImagesAction } from '@/app/memos/_actions/upload-image';
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

const generateId = () => `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Process a single file: compress and convert to WebP */
async function processFile(file: File): Promise<File> {
  return compressImage(file);
}

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
        } else {
          // Conversion failed, use original file and mark as error
          const file = filesToProcess[index];
          return {
            id: generateId(),
            file,
            preview: URL.createObjectURL(file),
            status: 'error' as const,
            error: result.reason?.message || 'HEIC conversion failed',
          };
        }
      });

      setImages(prev => [...prev, ...newImages]);
    },
    [images.length, maxCount],
  );

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image?.preview) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  }, []);

  const uploadAll = useCallback(
    async (memoId: string) => {
      return new Promise<{ success: boolean; paths: string[]; errors: string[] }>(resolve => {
        setImages(currentImages => {
          const pendingImages = currentImages.filter(img => img.status === 'pending');

          if (pendingImages.length === 0) {
            const successPaths = currentImages
              .filter(img => img.status === 'success' && img.path)
              .map(img => img.path!);
            resolve({ success: true, paths: successPaths, errors: [] });
            return currentImages;
          }

          (async () => {
            setIsUploading(true);

            setImages(prev =>
              prev.map(img =>
                img.status === 'pending' ? { ...img, status: 'uploading' as const } : img,
              ),
            );

            try {
              const fileDataPromises = pendingImages.map(async img => {
                const buffer = await img.file.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return {
                  id: img.id,
                  imageBase64: base64,
                  mimeType: 'image/webp',
                };
              });

              const fileData = await Promise.all(fileDataPromises);

              // 调用上传 Action
              const result = await uploadImagesAction(
                fileData.map(f => ({ imageBase64: f.imageBase64, mimeType: f.mimeType })),
                memoId,
                token,
              );

              if (!result.success) {
                setImages(prev =>
                  prev.map(img =>
                    img.status === 'uploading'
                      ? { ...img, status: 'error', error: result.error }
                      : img,
                  ),
                );
                resolve({ success: false, paths: [], errors: [result.error] });
                return;
              }

              const { paths: uploadedPaths, errors: uploadErrors } = result.data!;

              // 更新图片状态并收集成功路径
              let allSuccessPaths: string[] = [];
              setImages(prev => {
                const updatedImages = [...prev];
                let pathIndex = 0;
                let errorIndex = 0;

                for (const img of updatedImages) {
                  if (img.status === 'uploading') {
                    if (pathIndex < uploadedPaths.length) {
                      img.status = 'success';
                      img.path = uploadedPaths[pathIndex];
                      pathIndex++;
                    } else if (errorIndex < uploadErrors.length) {
                      img.status = 'error';
                      img.error = uploadErrors[errorIndex];
                      errorIndex++;
                    }
                  }
                }

                allSuccessPaths = updatedImages
                  .filter(img => img.status === 'success' && img.path)
                  .map(img => img.path!);

                return updatedImages;
              });

              resolve({
                success: uploadErrors.length === 0,
                paths: allSuccessPaths.length > 0 ? allSuccessPaths : uploadedPaths,
                errors: uploadErrors,
              });
            } catch (error) {
              resolve({ success: false, paths: [], errors: [String(error)] });
            } finally {
              setIsUploading(false);
            }
          })();

          return currentImages; // 先返回当前状态，后面异步更新
        });
      });
    },
    [token],
  );

  // 清空所有图片
  const clear = useCallback(() => {
    // 使用函数式更新，避免依赖 images
    setImages(prev => {
      // 释放预览 URL
      for (const img of prev) {
        if (img.preview && !img.preview.startsWith('http')) {
          URL.revokeObjectURL(img.preview);
        }
      }
      return [];
    });
  }, []);

  // 设置初始图片（编辑模式）
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

  // 获取已上传成功的路径
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
