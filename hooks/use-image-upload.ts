'use client';

import { useCallback, useState } from 'react';

import { uploadImagesAction } from '@/app/memos/_actions/upload-image';

interface PendingImage {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  path?: string;
  error?: string;
}

interface UseImageUploadOptions {
  maxCount?: number;
  token: string;
  id?: string;
}

interface UseImageUploadReturn {
  /** 待上传的图片列表 */
  images: PendingImage[];
  /** 已上传成功的图片路径 */
  uploadedPaths: string[];
  /** 是否正在上传 */
  isUploading: boolean;
  /** 添加图片 */
  addImages: (files: FileList | File[]) => void;
  /** 移除图片 */
  removeImage: (id: string) => void;
  /** 上传所有待上传的图片 */
  uploadAll: () => Promise<{ success: boolean; paths: string[]; errors: string[] }>;
  /** 清空所有图片 */
  clear: () => void;
  /** 设置初始图片（编辑模式） */
  setInitialImages: (paths: string[]) => void;
}

const generateId = () => `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function useImageUpload(options: UseImageUploadOptions): UseImageUploadReturn {
  const { maxCount = 9, token, id } = options;

  const [images, setImages] = useState<PendingImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addImages = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remainingSlots = maxCount - images.length;

      if (remainingSlots <= 0) {
        return;
      }

      const newImages: PendingImage[] = fileArray.slice(0, remainingSlots).map(file => ({
        id: generateId(),
        file,
        preview: URL.createObjectURL(file),
        status: 'pending' as const,
      }));

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

  const uploadAll = useCallback(async () => {
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
                mimeType: img.file.type,
              };
            });

            const fileData = await Promise.all(fileDataPromises);

            // 调用上传 Action
            const result = await uploadImagesAction(
              fileData.map(f => ({ imageBase64: f.imageBase64, mimeType: f.mimeType })),
              token,
              id,
            );

            // 更新图片状态并收集成功路径
            let allSuccessPaths: string[] = [];
            setImages(prev => {
              const updatedImages = [...prev];
              let pathIndex = 0;
              let errorIndex = 0;

              for (const img of updatedImages) {
                if (img.status === 'uploading') {
                  if (pathIndex < result.paths.length) {
                    img.status = 'success';
                    img.path = result.paths[pathIndex];
                    pathIndex++;
                  } else if (errorIndex < result.errors.length) {
                    img.status = 'error';
                    img.error = result.errors[errorIndex];
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
              success: result.errors.length === 0,
              paths: allSuccessPaths.length > 0 ? allSuccessPaths : result.paths,
              errors: result.errors,
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
  }, [token, id]);

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
    const initialImages: PendingImage[] = paths.map(path => ({
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
