'use client';

import { ImagePlus, Send, Settings, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Drawer } from 'vaul';

import { createMemoAction } from '@/app/memos/_actions/create-memo';
import { updateMemoAction } from '@/app/memos/_actions/update-memo';
import { useImageUpload } from '@/hooks/use-image-upload';
import { MAX_IMAGE_SIZE, SUPPORTED_IMAGE_TYPES } from '@/lib/constants/image';
import { generateId } from '@/lib/data/common';
import type { Memo } from '@/lib/data/memos';

import { useMemosContext } from '../_context/memos-context';
import { ImagePreviewGrid } from './image-preview-grid';
import MemosSettingsDrawer from './memos-settings-drawer';

interface MemosEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memo?: Memo;
}

export default function MemosEditorDrawer({ open, onOpenChange, memo }: MemosEditorDrawerProps) {
  const router = useRouter();
  const { token } = useMemosContext();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!memo;

  const {
    images,
    isUploading,
    addImages,
    removeImage,
    uploadAll,
    clear: clearImages,
    setInitialImages,
  } = useImageUpload({
    token: token || '',
    maxCount: 9,
  });

  // Fill content and images when opening in edit mode
  useEffect(() => {
    if (open && memo) {
      setContent(memo.content);
      if (memo.images.length > 0) {
        setInitialImages(memo.images);
      }
    } else if (!open) {
      setContent('');
      clearImages();
    }
  }, [open, memo, setInitialImages, clearImages]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const validFiles: File[] = [];
      for (const file of Array.from(files)) {
        if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
          toast.error(`Unsupported format: ${file.name}`);
          continue;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(`File too large: ${file.name} (max 10MB)`);
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        addImages(validFiles);
      }

      e.target.value = '';
    },
    [addImages],
  );

  const handleImageUpload = () => {
    if (!token) {
      setIsSettingsOpen(true);
      toast.error('Please set GitHub Token first');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!token) {
      setIsSettingsOpen(true);
      return;
    }

    if (!content.trim() && images.length === 0) {
      toast.error('Please enter content or upload images');
      return;
    }

    setIsSubmitting(true);

    const submitMemo = async () => {
      // For new memo: generate memoId upfront; for edit: use existing memo.id
      const memoId = isEditMode && memo ? memo.id : generateId('memo');

      const uploadResult = await uploadAll(memoId);
      if (!uploadResult.success && uploadResult.errors.length > 0) {
        throw new Error(uploadResult.errors[0]);
      }

      const imagePaths = uploadResult.paths;

      const result =
        isEditMode && memo
          ? await updateMemoAction({
              id: memo.id,
              content: content.trim(),
              images: imagePaths,
              token,
            })
          : await createMemoAction({
              id: memoId,
              content: content.trim(),
              images: imagePaths,
              token,
            });

      if (!result.success) {
        throw new Error(result.error || 'Operation failed');
      }

      return result;
    };

    toast.promise(submitMemo(), {
      loading: isEditMode ? 'Updating...' : 'Publishing...',
      success: () => {
        setContent('');
        clearImages();
        onOpenChange(false);
        router.refresh();
        return isEditMode ? 'Memo updated' : 'Memo published';
      },
      error: err => err.message || 'Operation failed',
      finally: () => setIsSubmitting(false),
    });
  };

  const isDisabled = isSubmitting || isUploading || (!content.trim() && images.length === 0);

  return (
    <>
      <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="bg-foreground/40 fixed inset-0 z-20" />
          <Drawer.Content className="bg-background md:border-r-none fixed top-0 right-0 bottom-0 z-20 flex w-[100vw] max-w-xl flex-col outline-none md:rounded-l-xl md:border md:border-gray-200 md:dark:border-gray-800">
            {/* Header  */}
            <div className="flex items-center justify-between p-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="hover:bg-muted opacity-70 transition-colors hover:opacity-100"
              >
                <XIcon className="size-6" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="hover:bg-muted opacity-70 transition-colors hover:opacity-100"
                  aria-label="Settings"
                >
                  <Settings className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={handleImageUpload}
                  className="hover:bg-muted opacity-70 transition-colors hover:opacity-100"
                  aria-label="Upload image"
                  disabled={images.length >= 9}
                >
                  <ImagePlus className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isDisabled}
                  className="hover:bg-muted opacity-70 transition-colors hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={isEditMode ? 'Update' : 'Publish'}
                >
                  <Send className="size-6" />
                </button>
              </div>
            </div>

            {/* Hidden title for accessibility */}
            <Drawer.Title className="sr-only">{isEditMode ? 'Edit Memo' : 'New Memo'}</Drawer.Title>

            {/* Editor area */}
            <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 pb-4">
              {/* 文本输入 */}
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write something..."
                className="placeholder:text-foreground/40 min-h-32 flex-1 resize-none bg-transparent text-base leading-relaxed outline-none"
              />

              {/* 图片预览 */}
              {images.length > 0 && (
                <ImagePreviewGrid images={images} onRemove={removeImage} className="mt-auto" />
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_IMAGE_TYPES.join(',')}
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Nested Settings Drawer */}
      <MemosSettingsDrawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
